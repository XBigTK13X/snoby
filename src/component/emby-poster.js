const settings = require('../settings')

NOT_FOUND_IMAGE_HREF = `../asset/img/media-not-found-vertical.png`

class EmbyPoster {
    constructor(embyItem) {
        this.embyItem = embyItem
        this.embyItemId = embyItem.Id
        this.href = embyItem.Href
        this.imageUrl = embyItem.getImageUrl(settings.imageDimensionShort, settings.imageDimensionTall)
        this.unwatchedCount = embyItem.getUnwatchedCount()
    }

    enableTitle() {
        this.title = this.embyItem.getTitle()
    }

    render() {
        let unwatchedBadge = this.unwatchedCount ? `<span class="top-right-badge">${this.unwatchedCount}</span>` : ''
        let titleMarkup = this.title ? `<div class="grid-item-title">${this.title}</div>` : ''
        let summary = this.embyItem.getSummary()
        let tooltipMarkup = summary ? `data-tippy-content="<div class='snowby-tooltip'>${summary}</div>"` : ''
        return `
        <div ${tooltipMarkup}>
	        <div class="grid-item tall-grid-item badge-container">
				<a
					data-target="random-action"
					href="${this.href}"
					onmouseover="window.showMediaSummary(${this.embyItemId})"
					onmouseout="window.hideMediaSummary(${this.embyItemId})"
					>
					<img class="lazy rounded tall-image" src="${NOT_FOUND_IMAGE_HREF}" data-src="${this.imageUrl}" />
				</a>
				${unwatchedBadge}
			</div>
			${titleMarkup}
		</div>
		`
    }
}

module.exports = EmbyPoster
