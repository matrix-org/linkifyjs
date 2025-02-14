/**
	Mention parser plugin for linkify
*/
import { registerPlugin } from '@matrix-org/linkifyjs';

export const mention = ({ scanner, parser, utils }) => {
	const { numeric, domain, HYPHEN, SLASH, UNDERSCORE, AT } = scanner.tokens;
	const Start = parser.start;

	const MentionToken = utils.createTokenClass('mention', {
		isLink: true,
		toHref() {
			return '/' + this.toString().substr(1);
		}
	});

	// @
	const At = Start.tt(AT); // @

	// Valid mention (not made up entirely of symbols)
	const Mention = At.tt(domain, MentionToken);
	At.tt(numeric, Mention);
	At.tt(UNDERSCORE, Mention);

	// More valid mentions
	Mention.tt(domain, Mention);
	Mention.tt(numeric, Mention);
	Mention.tt(UNDERSCORE, Mention);
	Mention.tt(HYPHEN, Mention);

	// Mention with a divider
	const MentionDivider = Mention.tt(SLASH);

	// Once we get a word token, mentions can start up again
	MentionDivider.tt(domain, Mention);
	MentionDivider.tt(numeric, Mention);
	MentionDivider.tt(UNDERSCORE, Mention);
	MentionDivider.tt(HYPHEN, Mention);
};

registerPlugin('mention', mention);
