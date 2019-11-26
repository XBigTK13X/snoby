class InternalLink {
	constructor(name, href){
		this.name = name
		this.href = href
	}

	render(){
		return `
			<a 
				class="center-grid-item"
				data-target="random-action"
				href="${this.href}"
			>
				${this.name}
			</a>
		`
	}
}

module.exports = InternalLink