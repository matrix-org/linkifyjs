---
layout: docv3
title: Core linkify · Documentation
toc: true
---

# Core Linkify

## Installation

### Node.js module

Install from the command line with NPM

```
npm install linkifyjs
```

Import into your JavaScript with `require`
```js
const linkify = require('linkifyjs');
```
or with ES modules

```js
import * as linkify from 'linkifyjs';
```

### Browser globals

[Download linkify](https://github.com/{{ site.github_username }}/releases/download/v{{ site.version }}/linkifyjs.zip)
and extract the contents into your website's assets directory.
Include the following script in your HTML:

```html
<script src="linkify.js"></script>
```

## Methods

### linkify.find _(str [, type])_

Finds all links in the given string

**Params**

* _`String`_ **`str`** Search string
* _`String`_ [**`type`**] only find links of the given type

**Returns** _`Array`_ List of links where each element is a hash with properties type, value, and href:

* **type** is the type of entity found. Possible values are
  - `'url'`
  - `'email'`
  - `'hashtag'` (with Hashtag plugin)
  - `'mention'` (with Mention plugin)
  - `'ticket'` (with Ticket plugin)
* **value** is the original entity substring.
* **href** should be the value of this link's `href` attribute.

```js
linkify.find('For help with GitHub.com, please email support@github.com');
```

Returns the array

```js
[
  {
    type: 'url',
    value: 'GitHub.com',
    href: 'http://github.com',
  },
  {
    type: 'email',
    value: 'support@github.com',
    href: 'mailto:support@github.com'
  }
]
```

### linkify.init()

**Avoid calling this manually.** `init()` runs automatically before invoking
linkify for the first time. Must be manually called after any plugins or custom
plugins get registered after the first invokation.

To avoid calling manually, register any plugins or protocols _before_ finding links:

```js
import * as linkify from 'linkifyjs'
import linkifyStr from 'linkify-string'
import 'linkify-plugin-hashtag'

linkify.registerCustomProtocol('fb')
linkify.registerPlugin('my-custom-plugin', () => { })

linkifyStr('Hello World.com!') // init() called automatically here on first invocation

// If registering new protocols or plugins *here*, call linkify.init() immediately after
```

### linkify.registerCustomProtocol _(str)_

Call this before invoking linkify for the first time. Linkify will consider any
string that begins with the given protocol followed by a `:` as a URL link.

**Params**

* _`String`_ **`str`** The protocol. May only contain characters `a-z` and `-` (hyphens)

```js
linkify.registerCustomProtocol('fb'); // now recognizes links such as fb://feed
linkify.registerCustomProtocol('instagram'); // now recognizes links such as instagram://account
```

### linkify.registerPlugin _(name, plugin)_

Register a custom plugin for detecting one or more new kinds of links. Call this
before invoking linkify for the first time.

**Params**

* _`String`_ **`name`** unique name of the plugin to register
• _`Function`_ **`plugin`** plugin implementation function

[See example plugin function implementations](https://github.com/{{ site.github_username }}/tree/master/packages/linkifyjs/src/plugins).

### linkify.test _(str [, type])_

Is the given string a link? Note that linkify is not 100% spec compliant, so this function may return some false positives or false negatives. If this method does not return the expected result for a specific input, [please report an issue](https://github.com/{{ site.github_username }}/issues).

**Params**

* _`String`_ **`str`** Test string
* _`String`_ [**`type`**] returns `true` only if the link is of the given type (see `linkify.find`),

**Returns** _`Boolean`_

```js
linkify.test('google.com'); // true
linkify.test('google.com', 'email'); // false
```

### linkify.tokenize _(str)_

Internal method that parses the given string into a generic token entity array.
Used by linkify's interfaces.

**Params**

* _`String`_ **`str`**

**Returns** _`Array`_