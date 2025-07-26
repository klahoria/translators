const HREF_ATTR_RE = /href\s*=\s*["'](https?:\/\/[^"']+)["']/i;
const str1= "abc https://abc.com aslfjaslfj";

const str = '<a href="https://abc.com">Click</a>';
console.log(HREF_ATTR_RE.test(str)); // true

// checks links in href
const match = str.match(HREF_ATTR_RE);
if (match) console.log("Link in href:", match[1]);


// checks links in string
const TEXT_LINK_RE = /\bhttps?:\/\/[^\s<>"']+/g;

console.log(TEXT_LINK_RE.test(str1)); // true
