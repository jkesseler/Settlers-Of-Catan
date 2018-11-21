import {deleteCard, addCard} from './actionTypes'

export const playCard = playedCard => {
  return (dispatch, getState) => {
    let {playerHand} = getState().playerState
    let elToRemove = playerHand.indexOf(playedCard)
    let updatedHand = playerHand.filter((card, i) => i !== elToRemove)
    dispatch(deleteCard(updatedHand))
  }
}

export const buyCard = cardToBuy => {
  return (dispatch, getState) => {
    let {playerHand} = getState().playerState
    dispatch(addCard([...playerHand, cardToBuy]))
  }
}