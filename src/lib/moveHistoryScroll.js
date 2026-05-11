export function scrollMoveHistoryToBottom(element) {
  if (!element) {
    return
  }

  element.scrollTop = element.scrollHeight
}
