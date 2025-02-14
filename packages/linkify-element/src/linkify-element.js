/**
	Linkify a HTML DOM node
*/
import { tokenize, Options } from '@matrix-org/linkifyjs';

const HTML_NODE = 1, TXT_NODE = 3;

/**
 * @param {HTMLElement} parent
 * @param {Text | HTMLElement} oldChild
 * @param {Array<Text | HTMLElement>} newChildren
 */
function replaceChildWithChildren(parent, oldChild, newChildren) {
	let lastNewChild = newChildren[newChildren.length - 1];
	parent.replaceChild(lastNewChild, oldChild);
	for (let i = newChildren.length - 2; i >= 0; i--) {
		parent.insertBefore(newChildren[i], lastNewChild);
		lastNewChild = newChildren[i];
	}
}

/**
 * @param {MultiToken[]} tokens
 * @param {Object} opts
 * @param {Document} doc A
 * @returns {Array<Text | HTMLElement>}
 */
function tokensToNodes(tokens, opts, doc) {
	const result = [];
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.t === 'nl' && opts.get('nl2br')) {
			result.push(doc.createElement('br'));
		} else if (!token.isLink || !opts.check(token)) {
			result.push(doc.createTextNode(token.toString()));
		} else {
			result.push(opts.render(token));
		}
	}

	return result;
}

/**
 * Requires document.createElement
 * @param {HTMLElement} element
 * @param {import("@matrix-org/linkifyjs/lib/linkify").Options} opts
 * @param {Document} doc
 * @returns {HTMLElement}
 */
function linkifyElementHelper(element, opts, doc) {

	// Can the element be linkified?
	if (!element || element.nodeType !== HTML_NODE) {
		throw new Error(`Cannot linkify ${element} - Invalid DOM Node type`);
	}

	// Is this element already a link?
	if (element.tagName === 'A' || opts.ignoreTags.indexOf(element.tagName) >= 0) {
		// No need to linkify
		return element;
	}

	let childElement = element.firstChild;

	while (childElement) {
		let str, tokens, nodes;

		switch (childElement.nodeType) {
		case HTML_NODE:
			linkifyElementHelper(childElement, opts, doc);
			break;
		case TXT_NODE: {
			str = childElement.nodeValue;
			tokens = tokenize(str);

			if (tokens.length === 0 || tokens.length === 1 && tokens[0].t === 'text') {
				// No node replacement required
				break;
			}

			nodes = tokensToNodes(tokens, opts, doc);

			// Swap out the current child for the set of nodes
			replaceChildWithChildren(element, childElement, nodes);

			// so that the correct sibling is selected next
			childElement = nodes[nodes.length - 1];

			break;
		}
		}

		childElement = childElement.nextSibling;
	}

	return element;
}

/**
 * @param {Document} doc The document implementaiton
 */
function getDefaultRender(doc) {
	return ({ tagName, attributes, content, eventListeners }) => {
		const link = doc.createElement(tagName);
		for (const attr in attributes) {
			link.setAttribute(attr, attributes[attr]);
		}

		if (eventListeners && link.addEventListener) {
			for (const event in eventListeners) {
				link.addEventListener(event, eventListeners[event]);
			}
		}

		link.appendChild(doc.createTextNode(content));
		return link;
	};
}

/**
 * Recursively traverse the given DOM node, find all links in the text and
 * convert them to anchor tags.
 *
 * @param {HTMLElement} element A DOM node to linkify
 * @param {Object} opts linkify options
 * @param {Document} [doc] (optional) window.document implementation, if differs from global
 * @returns {HTMLElement}
 */
export default function linkifyElement(element, opts, doc = null) {
	try {
		doc = doc || document || window && window.document || global && global.document;
	} catch (e) { /* do nothing for now */ }

	if (!doc) {
		throw new Error(
			'Cannot find document implementation. ' +
			'If you are in a non-browser environment like Node.js, ' +
			'pass the document implementation as the third argument to linkifyElement.'
		);
	}

	opts = new Options(opts, getDefaultRender(doc));
	return linkifyElementHelper(element, opts, doc);
}

// Maintain reference to the recursive helper to cache option-normalization
linkifyElement.helper = linkifyElementHelper;
linkifyElement.getDefaultRender = getDefaultRender;
linkifyElement.normalize = (opts, doc) => new Options(opts, getDefaultRender(doc));

