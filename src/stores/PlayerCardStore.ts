import { defineStore } from 'pinia'
import { changePosition, getCard, insertAfter, insertBefore, removeCard } from '@/utils'
import type { Element, Player, PowerCard } from '@/types'
import { useMessageStore } from './MessageStore'
import { useDiscardPowerStore } from './PowerDeckStore'
import { SPIRIT } from '@/constant'
import { useGameOptionStore } from '@/stores/GameOptionStore'

function createPlayer(index: number): Player {
  const { cards, panel } = SPIRIT[index]
  const hand: string[] = []
  for (let i = 0; i < cards.length; i++) {
    hand.push(`unique${index}-${i}`)
  }
  const disk = []
  const originalDisk = []
  let totalCardPlay = 0
  let income = 0
  if (panel) {
    const { ENERGY, CARD_PLAY, BASE_CARD_PLAY, BASE_ENERGY } = panel.value
    totalCardPlay = BASE_CARD_PLAY
    income = BASE_ENERGY
    disk.push([...ENERGY])
    disk.push([...CARD_PLAY])
    originalDisk.push([...ENERGY])
    originalDisk.push([...CARD_PLAY])
  }

  return {
    hand,
    discard: [],
    play: [],
    used: [],
    picking: [],
    energy: 0,
    energyThisTurn: 0,
    permanentElements: createDefaultElement(),
    showAspect: true,
    aspectMode: '1x',
    hasTakeIncome: false,
    disk,
    originalDisk,
    totalCardPlay,
    income
  }
}
function createDefaultElement(): { [K in Element]: number } {
  return {
    Any: 0,
    Sun: 0,
    Moon: 0,
    Fire: 0,
    Air: 0,
    Water: 0,
    Earth: 0,
    Plant: 0,
    Animal: 0
  }
}

export const usePlayerCardStore = defineStore('playerCard', {
  state: () => ({
    current: 0,
    players: [] as Player[]
  }),
  getters: {
    hand(state) {
      return state.players[state.current].hand
    },
    discard(state) {
      return state.players[state.current].discard
    },
    play(state) {
      const unused = state.players[state.current].play.filter((card) => !state.players[state.current].used.includes(card))
      return [...state.players[state.current].used, ...unused]
    },
    used(state) {
      return state.players[state.current].used
    },
    picking(state) {
      return state.players[state.current].picking.slice().reverse()
    },
    showAspect(state) {
      return state.players[state.current].showAspect
    },
    aspectMode(state) {
      return state.players[state.current].aspectMode
    },
    isPicking(state) {
      return state.players[state.current].picking.length > 0
    },
    getTypePicking(state) {
      const card = state.players[state.current].picking[0]
      return card?.split('-')[0]
    },
    elements(state) {
      const elements = createDefaultElement()
      state.players[state.current].play.forEach((id) => {
        const card = getCard(id) as PowerCard
        if (card) {
          card.elements.forEach((element) => {
            elements[element]++
          })
        }
      })
      Object.entries(state.players[state.current].permanentElements).forEach(([key, value]) => {
        elements[key] += value || 0
      })
      return elements
    },
    permanentElements(state) {
      return state.players[state.current].permanentElements
    },
    energy(state) {
      return state.players[state.current].energy
    },
    energyThisTurn(state) {
      return state.players[state.current].energyThisTurn
    },
    canReclaim(state) {
      const player = state.players[state.current]
      return player.hand.length === 0 && player.play.length === 0 && player.discard.length > 0
    },
    disk(state) {
      return state.players[state.current].disk
    },
    rawIndex(state) {
      return useGameOptionStore().spirits[state.current]
    },
    hasTakeIncome(state) {
      return state.players[state.current].hasTakeIncome
    }
  },
  actions: {
    reset() {
      this.current = 0
      this.players = []
    },
    addPlayer(spiritIndex: number) {
      this.players.push(createPlayer(spiritIndex))
      const index = this.players.length - 1
      this.current = index
      const rawIndex = useGameOptionStore().spirits[index]
      const { setup } = SPIRIT[rawIndex]
      if (setup) {
        setup(index)
      }
    },
    changeCurrent(index: number) {
      this.current = index
    },
    reclaim() {
      const player = this.players[this.current]
      player.hand = [...player.hand, ...player.discard]
      player.discard = []
      useMessageStore().setMessage('Reclaim cards')
    },
    reclaimOneCard(card: string) {
      const player = this.players[this.current]
      removeCard(player.discard, card)
      player.hand.push(card)
    },
    cleanUp() {
      this.players.forEach((player) => {
        player.discard = [...player.discard, ...player.play]
        player.play = []
        player.used = []
        player.energyThisTurn = 0
        player.hasTakeIncome = false
      })
    },
    take(card: string) {
      this.players[this.current].hand.push(card)
    },
    playCard(card: string, posId: { id: string; isFront: boolean } | undefined = undefined) {
      const cardData = getCard(card) as PowerCard
      const player = this.players[this.current]
      if (cardData.cost <= player.energy) {
        player.energy -= cardData.cost
        removeCard(player.hand, card)
        player.play.push(card)
        if (posId) {
          changePosition(player.play, card, posId)
        }
      } else {
        useMessageStore().setMessage('Not enough energy')
      }
    },
    addCardToPlay(card: string, playerIndex: number | undefined = undefined) {
      const player = this.players[playerIndex || this.current]
      player.play.push(card)
    },
    putCardInDiscard(card: string) {
      const player = this.players[this.current]
      removeCard(player.hand, card)
      player.discard.push(card)
    },
    returnCardFromPlay(card: string, posId: { id: string; isFront: boolean } | undefined = undefined) {
      const player = this.players[this.current]
      const cardData = getCard(card) as PowerCard
      player.energy += cardData.cost
      removeCard(player.play, card)
      removeCard(player.used, card)
      player.hand.push(card)
      if (posId) {
        changePosition(player.hand, card, posId)
      }
    },
    forgetCardFromHand(card: string) {
      const player = this.players[this.current]
      removeCard(player.hand, card)
      useDiscardPowerStore().discard.push(card)
      useMessageStore().setMessage('Forget card')
    },
    removeCardFromHand(card: string, playerIndex: number | undefined = undefined) {
      const player = this.players[playerIndex || this.current]
      removeCard(player.hand, card)
    },
    forgetCardFromDiscard(card: string) {
      const player = this.players[this.current]
      removeCard(player.discard, card)
      useDiscardPowerStore().discard.push(card)
      useMessageStore().setMessage('Forget card')
    },
    addToPicking(card: string) {
      this.players[this.current].picking.push(card)
    },
    takeCardFromPicking(card: string) {
      removeCard(this.players[this.current].picking, card)
      this.players[this.current].hand.push(card)
    },
    putCardToPicking(card: string) {
      const player = this.players[this.current]
      removeCard(player.hand, card)
      player.picking.push(card)
    },
    removeCardFromPicking(card: string) {
      removeCard(this.players[this.current].picking, card)
    },
    resetPicking() {
      this.players[this.current].picking = []
    },
    putFromPlayToDiscard(card: string) {
      const player = this.players[this.current]
      removeCard(player.play, card)
      removeCard(player.used, card)
      player.discard.push(card)
      useMessageStore().setMessage('Put card in discard')
    },
    addEnergy() {
      this.players[this.current].energy++
      this.players[this.current].energyThisTurn++
    },
    reduceEnergy(playerIndex: number | undefined = undefined) {
      if (this.players[playerIndex ?? this.current].energy > 0) {
        this.players[playerIndex ?? this.current].energy--
        if (this.players[playerIndex ?? this.current].energyThisTurn > 0) {
          this.players[playerIndex ?? this.current].energyThisTurn--
        }
      }
    },
    increaseElement(element: Element) {
      ;(this.players[this.current].permanentElements[element] as number)++
    },
    decreaseElement(element: Element) {
      if ((this.players[this.current].permanentElements[element] as number) > 0) {
        ;(this.players[this.current].permanentElements[element] as number)--
      }
    },
    setShowAspect(value: boolean) {
      this.players[this.current].showAspect = value
    },
    setAspectMode(mode: '1x' | '2x') {
      this.players[this.current].aspectMode = mode
    },
    toggleUsed(card: string) {
      const player = this.players[this.current]
      if (player.used.includes(card)) {
        removeCard(player.used, card)
      } else {
        player.used.push(card)
      }
    },
    changePosition(type: 'hand', card: string, posId: { id: string; isFront: boolean }) {
      const player = this.players[this.current]
      if (posId.id) {
        removeCard(player[type], card)
        if (posId.isFront) {
          insertAfter(player[type], card, posId.id)
        } else {
          insertBefore(player[type], card, posId.id)
        }
      }
    },
    diskClick(pos: number, row: number) {
      const player = this.players[this.current]
      const value = player.disk[row][pos]
      const isGet = value !== null
      if (isGet) {
        player.disk[row][pos] = null
      } else {
        player.disk[row][pos] = player.originalDisk[row][pos]
      }
      this.handleDiskEffect(player.originalDisk[row][pos], isGet, row)
    },
    handleDiskEffect(value: string | number | null, isGet: boolean, row: number) {
      if (!value) return
      const player = this.players[this.current]
      switch (row) {
        case 0: // ENERGY
          player.income += isGet ? value as number : -value as number
          break
        case 1:
          player.totalCardPlay += isGet ? value as number : -value as number
          break
      }
    },
    takeIncome() {
      const player = this.players[this.current]
      player.hasTakeIncome = true
      player.energy+= player.income
      player.energyThisTurn+= player.income
    }
  },
  persist: true
})
