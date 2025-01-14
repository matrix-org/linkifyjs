/**
	The scanner provides an interface that takes a string of text as input, and
	outputs an array of tokens instances that can be used for easy URL parsing.

	@module linkify
	@submodule scanner
	@main scanner
*/
import {
	makeState,
	makeAcceptingState,
	takeT,
	makeT,
	makeRegexT,
	makeBatchT,
	makeChainT
} from './fsm';
import * as tk from './tokens/text';
import { tlds, utlds } from './tlds';

// Note that these two Unicode ones expand into a really big one with Babel
export const ASCII_LETTER = /[a-z]/;
export const LETTER = /\p{L}/u; // Any Unicode character with letter data type
export const EMOJI = /\p{Emoji}/u; // Any Unicode emoji character
export const EMOJI_VARIATION = /\ufe0f/; // Variation selector, follows heart and others
export const DIGIT = /\d/;
export const SPACE = /\s/;

/**
 * Initialize the scanner character-based state machine for the given start
 * state
 * @param {[string, boolean][]} customSchemes List of custom schemes, where each
 * item is a length-2 tuple with the first element set to the string scheme, and
 * the second element set to `true` if the `://` after the scheme is optional
 * @return {State} scanner starting state
 */
export function init(customSchemes = []) {
	// Frequently used states (name argument removed during minification)
	const Start = makeState('Start');
	const NonAccepting = makeState('NonAccepting'); // must never have any transitions
	const Num = makeAcceptingState(tk.NUM, 'Num');
	const Word = makeAcceptingState(tk.WORD, 'Word');
	const UWord = makeAcceptingState(tk.UWORD, 'UWord');
	const Emoji = makeAcceptingState(tk.EMOJIS, 'Emoji');
	const Ws = makeAcceptingState(tk.WS, 'Ws');

	/**
	 * Create a state which emits a word token
	 */
	const makeWordState = (name) => {
		const state = makeAcceptingState(tk.WORD, name);
		state.jr = [[ASCII_LETTER, Word]];
		return state;
	};

	/**
	 * Same as previous, but specific to non-ASCII alphabet words
	 */
	const makeUWordState = (name) => {
		const state = makeAcceptingState(tk.UWORD, name);
		state.jr = [[ASCII_LETTER, NonAccepting], [LETTER, UWord]];
		return state;
	};

	/**
	 * Create a state which does not emit a word but the usual alphanumeric
	 * transitions are domains
	 */
	const makeNearWordState = (token, name) => {
		const state = makeWordState(name);
		state.t = token;
		return state;
	};

	/**
	 * Create a state which does not emit a word but the usual alphanumeric
	 * transitions are domains
	 */
	const makeNearUWordState = (token, name) => {
		const state = makeUWordState(name);
		state.t = token;
		return state;
	};

	// States for special URL symbols that accept immediately after start
	makeBatchT(Start, [
		["'", makeAcceptingState(tk.APOSTROPHE)],
		['{', makeAcceptingState(tk.OPENBRACE)],
		['[', makeAcceptingState(tk.OPENBRACKET)],
		['<', makeAcceptingState(tk.OPENANGLEBRACKET)],
		['(', makeAcceptingState(tk.OPENPAREN)],
		['}', makeAcceptingState(tk.CLOSEBRACE)],
		[']', makeAcceptingState(tk.CLOSEBRACKET)],
		['>', makeAcceptingState(tk.CLOSEANGLEBRACKET)],
		[')', makeAcceptingState(tk.CLOSEPAREN)],
		['&', makeAcceptingState(tk.AMPERSAND)],
		['*', makeAcceptingState(tk.ASTERISK)],
		['@', makeAcceptingState(tk.AT)],
		['`', makeAcceptingState(tk.BACKTICK)],
		['^', makeAcceptingState(tk.CARET)],
		[':', makeAcceptingState(tk.COLON)],
		[',', makeAcceptingState(tk.COMMA)],
		['$', makeAcceptingState(tk.DOLLAR)],
		['.', makeAcceptingState(tk.DOT)],
		['=', makeAcceptingState(tk.EQUALS)],
		['!', makeAcceptingState(tk.EXCLAMATION)],
		['-', makeAcceptingState(tk.HYPHEN)],
		['%', makeAcceptingState(tk.PERCENT)],
		['|', makeAcceptingState(tk.PIPE)],
		['+', makeAcceptingState(tk.PLUS)],
		['#', makeAcceptingState(tk.POUND)],
		['?', makeAcceptingState(tk.QUERY)],
		['"', makeAcceptingState(tk.QUOTE)],
		['/', makeAcceptingState(tk.SLASH)],
		[';', makeAcceptingState(tk.SEMI)],
		['~', makeAcceptingState(tk.TILDE)],
		['_', makeAcceptingState(tk.UNDERSCORE)],
		['\\', makeAcceptingState(tk.BACKSLASH)]
	]);

	// Whitespace jumps
	// Tokens of only non-newline whitespace are arbitrarily long
	makeT(Start, '\n', makeAcceptingState(tk.NL, 'Nl'));
	makeRegexT(Start, SPACE, Ws);

	// If any whitespace except newline, more whitespace!
	makeT(Ws, '\n', makeState()); // non-accepting state
	makeRegexT(Ws, SPACE, Ws);

	// Generates states for top-level domains
	// Note that this is most accurate when tlds are in alphabetical order
	for (let i = 0; i < tlds.length; i++) {
		makeChainT(Start, tlds[i], makeNearWordState(tk.TLD), makeWordState);
	}
	for (let i = 0; i < utlds.length; i++) {
		makeChainT(Start, utlds[i], makeNearUWordState(tk.UTLD), makeUWordState);
	}

	// Collect the states generated by different protocls
	const DefaultScheme = makeNearWordState(tk.SCHEME, 'DefaultScheme');
	const DefaultSlashScheme = makeNearWordState(tk.SLASH_SCHEME, 'DefaultSlashScheme');
	makeChainT(Start, 'file', DefaultScheme, makeWordState);
	makeChainT(Start, 'mailto', DefaultScheme, makeWordState);
	makeChainT(Start, 'ftp', DefaultSlashScheme, makeWordState);
	makeChainT(Start, 'http', DefaultSlashScheme, makeWordState);

	// Secure (https, ftps) protocols (end with 's')
	makeT(DefaultSlashScheme, 's', DefaultSlashScheme);

	// Register custom schemes
	const CustomScheme = makeNearWordState(tk.SCHEME, 'CustomScheme');
	const CustomSlashScheme = makeNearWordState(tk.SLASH_SCHEME, 'CustomSlashScheme');
	const CustomCompoundScheme = makeAcceptingState(tk.SCHEME, 'CustomCompoundScheme');
	const CustomCompoundSlashScheme = makeAcceptingState(tk.SLASH_SCHEME, 'CustomCompoundSlashScheme');
	customSchemes = customSchemes.sort((a, b) => a[0] > b[0] ? 1 : -1);
	for (let i = 0; i < customSchemes.length; i++) {
		const schemeParts = customSchemes[i][0].split('-');
		const schemeState = schemeParts.length === 1
			? (customSchemes[i][1] ? CustomScheme : CustomSlashScheme)
			: (customSchemes[i][1] ? CustomCompoundScheme : CustomCompoundSlashScheme);

		let state = Start;
		for (let j = 0; j < schemeParts.length; j++) {
			let defaultStateFactory = j === 0 ? makeWordState : makeState;
			let endState = j === schemeParts.length - 1 ? schemeState : defaultStateFactory();
			state = makeChainT(state, schemeParts[j], endState, defaultStateFactory);
			if (schemeParts.length > 1 && j < schemeParts.length - 1) {
				state = makeT(state, '-', makeState());
			}
		}
	}

	// Localhost token
	makeChainT(Start, 'localhost', makeNearWordState(tk.LOCALHOST), makeWordState);

	// Everything else
	// Number and character transitions
	makeRegexT(Start, DIGIT, Num);
	makeRegexT(Start, ASCII_LETTER, Word);
	makeRegexT(Start, LETTER, UWord);
	makeRegexT(Start, EMOJI, Emoji);
	makeRegexT(Start, EMOJI_VARIATION, Emoji); // This one is sketchy
	makeRegexT(Num, DIGIT, Num);
	makeRegexT(Word, ASCII_LETTER, Word);
	makeRegexT(UWord, ASCII_LETTER, NonAccepting);
	makeRegexT(UWord, LETTER, UWord);
	makeRegexT(Emoji, EMOJI, Emoji);
	makeRegexT(Emoji, EMOJI_VARIATION, Emoji);

	// Account for zero-width joiner for chaining multiple emojis
	// Not sure if these are actu
	const EmojiJoiner = makeState();
	makeT(Emoji, '\u200d', EmojiJoiner);
	makeRegexT(EmojiJoiner, EMOJI, Emoji);
	makeRegexT(EmojiJoiner, EMOJI_VARIATION, Emoji);

	// Set default transition for start state (some symbol)
	Start.jd = makeAcceptingState(tk.SYM, 'Sym');
	return Start;
}

/**
	Given a string, returns an array of TOKEN instances representing the
	composition of that string.

	@method run
	@param {State} start scanner starting state
	@param {string} str input string to scan
	@return {{t: string, v: string, s: number, l: number}[]} list of tokens, each with a type and value
*/
export function run(start, str) {
	// State machine is not case sensitive, so input is tokenized in lowercased
	// form (still returns regular case). Uses selective `toLowerCase` because
	// lowercasing the entire string causes the length and character position to
	// vary in some non-English strings with V8-based runtimes.
	const iterable = stringToArray(str.replace(/[A-Z]/g, (c) => c.toLowerCase()));
	const charCount = iterable.length; // <= len if there are emojis, etc
	const tokens = []; // return value

	// cursor through the string itself, accounting for characters that have
	// width with length 2 such as emojis
	let cursor = 0;

	// Cursor through the array-representation of the string
	let charCursor = 0;

	// Tokenize the string
	while (charCursor < charCount) {
		let state = start;
		let nextState = null;
		let tokenLength = 0;
		let latestAccepting = null;
		let sinceAccepts = -1;
		let charsSinceAccepts = -1;

		while (charCursor < charCount && (nextState = takeT(state, iterable[charCursor]))) {
			state = nextState;

			// Keep track of the latest accepting state
			if (state.accepts()) {
				sinceAccepts = 0;
				charsSinceAccepts = 0;
				latestAccepting = state;
			} else if (sinceAccepts >= 0) {
				sinceAccepts += iterable[charCursor].length;
				charsSinceAccepts++;
			}

			tokenLength += iterable[charCursor].length;
			cursor += iterable[charCursor].length;
			charCursor++;
		}

		// Roll back to the latest accepting state
		cursor -= sinceAccepts;
		charCursor -= charsSinceAccepts;
		tokenLength -= sinceAccepts;

		// No more jumps, just make a new token from the last accepting one
		// TODO: If possible, don't output v, instead output range where values ocur
		tokens.push({
			t: latestAccepting.t, // token type/name
			v: str.substr(cursor - tokenLength, tokenLength), // string value
			s: cursor - tokenLength, // start index
			e: cursor // end index (excluding)
		});
	}

	return tokens;
}

export { tk as tokens };

/**
 * Convert a String to an Array of characters, taking into account that some
 * characters like emojis take up two string indexes.
 *
 * Adapted from core-js (MIT license)
 * https://github.com/zloirock/core-js/blob/2d69cf5f99ab3ea3463c395df81e5a15b68f49d9/packages/core-js/internals/string-multibyte.js
 *
 * @function stringToArray
 * @param {string} str
 * @returns {string[]}
 */
 function stringToArray(str) {
	const result = [];
	const len = str.length;
	let index = 0;
	while (index < len) {
		let first = str.charCodeAt(index);
		let second;
		let char = first < 0xd800 || first > 0xdbff || index + 1 === len
		|| (second = str.charCodeAt(index + 1)) < 0xdc00 || second > 0xdfff
			? str[index] // single character
			: str.slice(index, index + 2); // two-index characters
		result.push(char);
		index += char.length;
	}
	return result;
}
