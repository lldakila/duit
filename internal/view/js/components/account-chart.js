import {
	Button,
	LoadingSign
} from "./_components.min.js";

import {
	mergeObject,
} from "../libs/utils.min.js"

import {
	i18n
} from "../i18n/i18n.min.js"

export function AccountChart() {
	let state = {
		chart: null,
		nAccount: 0,
		needToRefresh: false
	}

	// Local methods
	function getColor(idx) {
		if (state.nAccount === 0) return "#DDD"
		let hue = Math.round(360 / state.nAccount) * idx
		return `hsl(${hue},100%,40%)`
	}

	function shortenAmount(val) {
		const trillion = 1000000000000,
			billion = 1000000000,
			million = 1000000,
			thousand = 1000

		let isNegative = val < 0
		if (isNegative) val = Math.abs(val)

		let short = val
		if (val >= trillion) short = Math.round(val / trillion) + "T"
		else if (val >= billion) short = Math.round(val / billion) + "B"
		else if (val >= million) short = Math.round(val / million) + "M"
		else if (val >= thousand) short = Math.round(val / thousand) + "K"

		return isNegative ? "-" + short : short
	}

	function renderChart(dom, opts) {
		if (opts.accounts.length == 0) return
		if (opts.series.length == 0) return

		// Detach the old chart
		if (state.chart != null && typeof state.chart.detach == "function") {
			state.chart.detach()
		}

		// Find chart content
		let chartBox = dom.querySelector(".account-chart__content")
		if (chartBox == null) return

		// Create labels
		let labels = [
			i18n("Jan"), i18n("Feb"), i18n("Mar"), i18n("Apr"),
			i18n("May"), i18n("Jun"), i18n("Jul"), i18n("Aug"),
			i18n("Sep"), i18n("Oct"), i18n("Nov"), i18n("Dec"),
		]

		// Normalize series
		let normalizedSeries = opts.accounts.map(account => {
			let series = new Array(12).fill(null)
			opts.series
				.filter(cs => cs.accountId === account.id)
				.forEach(cs => series[cs.month - 1] = cs.amount)
			return series
		})

		// Render final table
		state.chart = new Chartist.Line(chartBox, {
			labels: labels,
			series: normalizedSeries
		}, {
			fullWidth: true,
			lineSmooth: Chartist.Interpolation.none({
				fillHoles: true,
			}),
			chartPadding: {
				top: 24,
				right: 24,
				bottom: 8,
				left: 8
			},
			axisY: {
				low: undefined,
				high: undefined,
				scaleMinSpace: 30,
				labelInterpolationFnc: shortenAmount
			},
			axisX: {
				labelOffset: {
					x: -8,
					y: 0
				}
			},
			plugins: [
				Chartist.plugins.ctPointLabels({
					textAnchor: "middle",
					labelInterpolationFnc: shortenAmount
				})
			]
		})

		state.chart.on("draw", function (context) {
			if (context.type === "line" || context.type === "point") {
				context.element.attr({
					style: `stroke: ${getColor(context.seriesIndex)}`
				});
			}
		});

		state.needToRefresh = false
	}

	// Render view
	function renderView(vnode) {
		// Parse attributes and set default value
		let loading = vnode.attrs.loading,
			className = vnode.attrs.class,
			year = vnode.attrs.year,
			accounts = vnode.attrs.accounts,
			minValue = vnode.attrs.min,
			maxValue = vnode.attrs.max,
			series = vnode.attrs.series,
			onYearChanged = vnode.attrs.onYearChanged

		if (typeof loading != "boolean") loading = false
		if (typeof className != "string") className = ""
		if (typeof year != "number") year = new Date().getFullYear()
		if (!Array.isArray(accounts)) accounts = []
		if (typeof minValue != "number") minValue = undefined
		if (typeof maxValue != "number") maxValue = undefined
		if (!Array.isArray(series)) series = []
		if (typeof onYearChanged != "function") onYearChanged = () => { }

		// Save count of account to state
		state.nAccount = accounts.length

		// Prepare chart contents
		let isEmpty = accounts.length == 0 || series.length == 0,
			contents = []

		if (loading) {
			contents.push(m(LoadingSign, { class: "account-chart__loading-sign" }))
		} else if (isEmpty) {
			contents.push(m("p.account-chart__empty-message", i18n("No chart data available")))
		} else {
			// Create header
			contents.push(m(".account-chart__header",
				accounts.map((account, idx) => {
					return m("p.account-chart__legend",
						m("span.account-chart__legend__color", { style: `background:${getColor(idx)}` }),
						account.name
					)
				})
			))

			// Put chart content
			contents.push(m(".account-chart__wrapper", m(".account-chart__content")))
		}

		// If needed add footer as well
		if (!loading) {
			let maxYear = new Date().getFullYear(),
				attrs = {
					iconOnly: true,
					tooltipPosition: "top",
					class: "chart__footer__button",
				}

			contents.push(m(".account-chart__footer",
				m(Button, mergeObject(attrs, {
					icon: "fa-angle-left",
					caption: i18n("Last year"),
					enabled: !state.loading,
					onclick() { onYearChanged(year - 1) }
				})),
				m("p.account-chart__footer__year", `${year}`),
				m(Button, mergeObject(attrs, {
					icon: "fa-angle-right",
					caption: i18n("Next year"),
					enabled: !state.loading && year < maxYear,
					onclick() { onYearChanged(year + 1) }
				})),
			))
		}

		// Render final view
		return m(".account-chart", { class: className }, contents)
	}

	function onBeforeViewUpdated(vnode, old) {
		// Parse attributes
		let year = vnode.attrs.year,
			oldYear = old.attrs.year,
			accounts = vnode.attrs.accounts,
			oldAccounts = old.attrs.accounts,
			minValue = vnode.attrs.min,
			oldMinValue = old.attrs.min,
			maxValue = vnode.attrs.max,
			oldMaxValue = old.attrs.max,
			series = vnode.attrs.series,
			oldSeries = old.attrs.series

		if (typeof year != "number") year = 0
		if (typeof oldYear != "number") oldYear = 0
		if (!Array.isArray(accounts)) accounts = []
		if (!Array.isArray(oldAccounts)) oldAccounts = []
		if (typeof minValue != "number") minValue = 0
		if (typeof oldMinValue != "number") oldMinValue = 0
		if (typeof maxValue != "number") maxValue = undefined
		if (typeof oldMaxValue != "number") oldMaxValue = 0
		if (!Array.isArray(series)) series = []
		if (!Array.isArray(oldSeries)) oldSeries = []

		// Check simple value
		if (year !== oldYear ||
			minValue !== oldMinValue ||
			maxValue !== oldMaxValue ||
			accounts.length !== oldAccounts.length ||
			series.length !== oldSeries.length) {
			state.needToRefresh = true
			return
		}

		// Check if series changed
		let seriesChanged = oldSeries.some((oldSet, idx) => {
			let newSet = series[idx],
				strOldSet = JSON.stringify(oldSet),
				strNewSet = JSON.stringify(newSet)
			return strOldSet !== strNewSet
		})

		if (seriesChanged) {
			state.needToRefresh = true
			return
		}

		// Check if accounts changed
		let accountsChanged = oldAccounts.some((oldAccount, idx) => {
			let newAccount = accounts[idx],
				strOldAccount = JSON.stringify(oldAccount),
				strNewAccount = JSON.stringify(newAccount)
			return strOldAccount !== strNewAccount
		})

		if (accountsChanged) {
			state.needToRefresh = true
			return
		}
	}

	function onViewUpdated(vnode) {
		// Parse attributes and set default value
		let accounts = vnode.attrs.accounts,
			minValue = vnode.attrs.min,
			maxValue = vnode.attrs.max,
			series = vnode.attrs.series

		if (!Array.isArray(accounts)) accounts = []
		if (typeof minValue != "number") minValue = undefined
		if (typeof maxValue != "number") maxValue = undefined
		if (!Array.isArray(series)) series = []

		if (state.needToRefresh) {
			renderChart(vnode.dom, {
				accounts: accounts,
				minValue: minValue,
				maxValue: maxValue,
				series: series,
			})
		}
	}

	return {
		view: renderView,
		onupdate: onViewUpdated,
		onbeforeupdate: onBeforeViewUpdated
	}
}