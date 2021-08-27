#!/usr/bin/env node

const { program } = require("commander");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');
const debug = require('debug')('dummyhtml');

const config = {
  dummy: {}
};
config.dummy.baseDir = 'dummy';
config.dummy.cssPath = `${config.dummy.baseDir}/css`;
config.dummy.imgPath = `${config.dummy.baseDir}/img`;
config.dummy.jsPath = `${config.dummy.baseDir}/js`;
config.dummy.server = 'https://www.example.com';
config.dummy.site = `${config.dummy.server}/${config.dummy.baseDir}`

program
  .name('dummyhtml.js')
  .version('1.0.2')
  .usage('[options] htmlpath')
  .showHelpAfterError()
  .option('-a, --all', 'output all element nodes')
  .option('-t, --tree', 'output dom tree only')
  .option('--no-head', 'remove html head from output')
  .option('--head <path>', 'include html head from template file')
  .option('--placeholder', 'embed placeholder images')
  .option('--rehash', 'rehash Lorem Ipsum table')
  .option('--fill', 'insert dummy text to elements with no content');

program.parse(process.argv);
const options = program.opts();
if (!options.tree) {
  options.all = false;
}
debug('options', options);

const htmlPath = program.args.length? program.args[0]: '/dev/stdin';

let head = null;
// default html head
const default_html_head =
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Document</title>
</head>
`;

if (!options.tree && options.head) {
  if (options.head === true) {
    head = default_html_head;
  } else {
    try {
      head = fs.readFileSync(options.head, { encoding: 'utf8' });
      head = head.replace(/<body>[^]*<\/html>\s*/, '');
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }
  debug('head', head);
}

let reader;
if (/^https?:\/{2}/.test(htmlPath)) {
  reader = JSDOM.fromURL(htmlPath);
} else {
  reader = JSDOM.fromFile(htmlPath);
}

reader.then(dom => {
  const { document } = dom.window;
  if (!options.tree && options.head) {
    process.stdout.write(head);
  }
  writeNode(document.body, 0);
  process.stdout.write('\n');
  if (!options.tree && options.head) {
    process.stdout.write('</html>\n');
  }
})
.catch(err => {
  console.error(err.message);
});

const void_elements = [
  'area', 'base', 'br', 'col', 'embed',
  'hr', 'img', 'input', 'keygen', 'link',
  'meta', 'param', 'source', 'track', 'wbr'
];

const inline_elements = [
  'a', 'abbr', 'acronym', 'audio', 'b',
  'bdi', 'bdo', 'big', 'br', 'button',
  'canvas', 'cite', 'code','data', 'datalist',
  'del', 'dfn', 'em', 'embed', 'i',
  'iframe', 'img', 'input', 'ins', 'kbd',
  'label', 'map', 'mark', 'meter', 'noscript',
  'object', 'output', 'picture', 'progress', 'q',
  'ruby', 's', 'samp', 'script', 'select',
  'slot', 'small', 'span', 'strong', 'sub',
  'sup', 'svg', 'template', 'textarea', 'time',
  'u', 'tt', 'var', 'video', 'wbr'
];

const nobr_before_end_tag = [
  'dt',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p'
];

const br_before_start_tag = [
  'iframe', 'noscript',
  'picture', 'script', 'source', 'video'
];

const br_before_end_tag = [
  'picture', 'video'
];

const ignore_elements = [
  'link', 'script', 'style', 'svg'
];

const fill_enable_elements = [
  'a', 'div', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'p'
];

function is_ignore(node) {
  return ignore_elements.includes(node.localName);
}

function is_nl_before_start(node) {
  const tag = node.localName;
  if (tag == 'body') {
    return false;
  }
  if (!inline_elements.includes(tag)) {
    return true;
  }
  if (br_before_start_tag.includes(tag)) {
    return true;
  }
  if (tag == 'img') {
    const parent = node.parentNode;
    if (parent.localName == 'picture') {
      return true;
    }
  }
  return false;
}

function is_nl_before_close(node, reduced) {
  if (!node.firstElementChild) { // empty node
    return false;
  }
  const tag = node.localName;
  if (inline_elements.includes(tag)) {
    if (br_before_end_tag.includes(tag)) {
      return true;
    }
  } else { // block-level elements
    if (nobr_before_end_tag.includes(tag)) {
      return false;
    }
    return !reduced;
  }
  return false;
}

const attributes = [
  'alt', 'datetime', 'height', 'label', 'href', 'rel',
  'src', 'srclang', 'srcset', 'target', 'type', 'media',
  'sizes', 'width',
  // Deprecated attributes
  'frameborder'
];

const use_actual_value = [
    'datetime', 'frameborder', 'height', 'media',
    'sizes', 'srclang', 'width'
];

function getDummyAttributes(node) {
  let str = '';
  const tag = node.localName;
  const attrs = node.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i].name;
    if (attributes.includes(a)) {
      const actual = attrs[i].value;
      const dummy = toDummyValue(tag, a, actual, node);
      debug('attr: %s %s %s', a, actual, dummy);
      if (dummy !== null) {
        str += ` ${a}="${dummy}"`;
      }
    }
  }
  if (tag == 'time') {
    if (!node.hasAttribute('datetime')) {
      const date = '2021-07-20';
      str += ` datetime="${date}"`;
    }
  }
  return str;
}

const sequence = {
  id: 1,
  url: 1,
  style: 1,
  image: 1,
  video: 1,
  script: 1,
  captions: 1,
  optgroup: 1
};

function toDummyURL(actual) {
  let url;
  actual = actual.trim();
  if (/^#/.test(actual)) {
    if (actual == '#') {
      return '#';
    }
    url = `#id${sequence.id++}`
  } else if (/^(https?:)?\/{2}/.test(actual)){
    url = `${config.dummy.site}/page${sequence.url++}.html`
  } else {
    url = `${config.dummy.baseDir}/page${sequence.url++}.html`
  }
  return url;
}

function toDummyCSS(/*actual*/) {
  return `${config.dummy.cssPath}/style${sequence.style++}.css`;
}

const mime_types = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm'
}

function type2suffix(node) {
  if (node.hasAttribute('type')) {
    let v = node.getAttribute('type');
    for (const type in mime_types) {
      if (type == v) {
        return mime_types[type];
      }
    }
  }
  return 'png';
}

function getDimension(node, width, height) {
  if (node.hasAttribute('width')) {
    width = node.getAttribute('width');
  }
  if (node.hasAttribute('height')) {
    height = node.getAttribute('height');
  }
  return [width, height];
}

function toDummyImage(actual, node) {
  let suffix = actual.match(/\.(jpe?g|png|gif|webp)$/i);
  suffix = suffix? suffix[1].toLowerCase(): type2suffix(node);
  if (options.placeholder) {
    let width, height;
    [width, height] = getDimension(node, 100, 100);
    return `https://via.placeholder.com/${width}x${height}.${suffix}`;
  }
  return `${config.dummy.imgPath}/img${sequence.image++}.${suffix}`;
}

function toDummyVideo(actual, node) {
  let suffix = actual.match(/\.(mp4|webm)$/i);
  suffix = suffix? suffix[1].toLowerCase(): type2suffix(node);
  return `${config.dummy.imgPath}/video${sequence.video++}.${suffix}`;
}

function toDummyTrack(actual, node) {
  let lang = 'en';
  if (node.hasAttribute('srclang')) {
    lang = node.getAttribute('srclang');
  }
  return `${config.dummy.imgPath}/caption${sequence.caption++}_${lang}.vtt`;
}

function toDummyScript(/*actual*/) {
  return `${config.dummy.jsPath}/app${sequence.script++}.js`;
}

function toDummyValue(tag, attr, actual, node) {
  if (attr == 'alt') {
    return '';
  }
  if (attr == 'type') {
    if (tag == 'button' || tag == 'input' || tag == 'source') {
      return actual;
    }
    return null;
  }
  if (attr == 'href') {
    if (tag == 'a' || tag == 'area') {
      return toDummyURL(actual);
    } else if (tag == 'link') {
      return toDummyCSS(actual);
    }
    return null;
  }
  if (attr == 'src') {
    if (tag == 'img') {
      return toDummyImage(actual, node);
    } else if (tag == 'source' || tag == 'video') {
      return toDummyVideo(actual, node);
    } else if (tag == 'script') {
      return toDummyScript(actual);
    } else if (tag == 'track') {
      return toDummyTrack(actual, node);
    } else if (tag == 'iframe') {
      return toDummyURL(actual);
    }
    return null;
  }
  if (attr == 'srcset') {
    if (tag == 'img') {
      return `${toDummyImage(actual, node)} 200w, ${toDummyImage(actual, node)} 400w`;
    } else if (tag == 'source') {
      return toDummyImage(actual, node);
    }
    return null;
  }
  if (attr == 'label') {
    if (tag == 'optgroup') {
      return `group${sequence.optgroup++}`;
    }
  }
  if (use_actual_value.includes(attr)) {
    return actual;
  }
  if (attr == 'rel') {
    return (tag == 'link')? actual: null;
  }
  if (attr == 'target') {
    return (tag == 'a')? actual: null;
  }
  return null;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const text_count_log = [];
let rehashed = false;

function writeDummyText(node, fill) {
  let count = 0;
  let is_timeval = false;
  if (node.localName == 'time' || node.parentNode.localName == 'time') {
    is_timeval = true;
  }
  node.childNodes.forEach(e => {
    if (e.nodeType !== TEXT_NODE) {
      return;
    }
    if (/[^ \f\n\r\t\v]/.test(e.textContent)) {
      let newstr = null;
      let size = Math.floor(e.textContent.length / 5);
      if (size < 1) {
        size = 1;
      }
      if (size > 100) {
        size = 100;
      }
      if (size < 5) {
        let check = e.textContent.trim();
        if (!/[^0-9_!-/:-@[-`{-~]/.test(check)) {
          newstr = e.textContent;
        }
      }
      if (is_timeval) {
        newstr = toTimeVal(e.textContent);
      }
      if (fill) {
        newstr = null;
      }
      if (!newstr) {
        if (options.rehash && !rehashed) {
          rehashLoremIpsum();
          rehashed = true;
        }
        newstr = LoremIpsum(size);
      }
      process.stdout.write(newstr);
      count++;
    }
  });
  text_count_log.push(count);
  return count;
}

function toTimeVal(s) {
  const patterns = [
    /(19|20)[0-9]{2}(-|\/)(0|1)?[0-9](-|\/)[0-3]?[0-9]/,
    /([1-9]|1[0-2])\/([1-2][0-9]|3[0-1]|[1-9])/,
    /([0-1]?[0-9]|2[0-4]):[0-5][0-9]/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const re = patterns[i];
    if (re.test(s)) {
      return s;
    }
  }
  return '--:--';
}

function getDefaultButtonLabel(node) {
  if (node.hasAttribute('type')) {
    return node.getAttribute('type');
  }
  return 'button';
}

function writeNode(node, depth) {
  const tag = node.localName;
  const space = indent(depth);
  const WRT_STATE = { NONE: 0, LINE_OPENED: 1 }
  let state = WRT_STATE.NONE ;

  if (!options.all && is_ignore(node)) {
    return state;
  }
  if (is_nl_before_start(node)) {
    process.stdout.write('\n' + space);
    state = WRT_STATE.LINE_OPENED;
  }
  let attr = '';
  if (!options.tree && node.hasAttributes()) {
    attr = getDummyAttributes(node);
  }
  process.stdout.write(`<${tag}${attr}>`);
  if (void_elements.includes(tag)) {
    return state;
  }
  let first = true;
  let reduced = true;
  let fill = false;
  let child;
  if (!options.tree) {
    let dx = text_count_log.length;
    child = node.firstChild;
    if (options.fill && !child) {
      if (fill_enable_elements.includes(tag)) {
        node.textContent = 'a';
        child = node.firstChild;
        fill = true;
      }
    }
    while (child) {
      if (child.nodeType === ELEMENT_NODE) {
        const st = writeNode(child, depth + 1);
        if (first && st === WRT_STATE.LINE_OPENED) {
          reduced = false;
        }
        first = false;
      } else if (child.nodeType === TEXT_NODE) {
        writeDummyText(node, fill);
      }
      child = child.nextSibling;
    }
    dx = text_count_log.length - dx;
    if (tag == 'button' && !dx) {
      let newstr = getDefaultButtonLabel(node);
      process.stdout.write(newstr);
      text_count_log.push(1);
    }
  } else {
    child = node.firstElementChild;
    while (child) {
      const st = writeNode(child, depth + 1);
      if (first && st === WRT_STATE.LINE_OPENED) {
        reduced = false;
      }
      first = false;
      child = child.nextElementSibling;
    }
  }
  if (is_nl_before_close(node, reduced)) {
    process.stdout.write('\n' + space);
  }
  process.stdout.write(`</${tag}>`);
  return state;
}

function indent(depth) {
  const tab = '  ';
  let space = '';
  for (let i = 0; i < depth; i++) {
    space += tab;
  }
  return space;
}

// Lorem Ipsum generator
const phrase_list = [
  'lorem ipsum dolor sit amet',
  'consectetur adipiscing elit',
  'fusce sed orci tempor',
  'efficitur elit sed',
  'feugiat quam',
  'morbi in euismod massa',
  'vulputate posuere turpis',
  'vivamus iaculis',
  'sapien nec nunc volutpat',
  'nec pulvinar lorem volutpat',
  'aliquam at pretium dui',
  'nulla tincidunt',
  'nulla at dolor',
  'viverra aliquet',
  'cras ac arcu cursus',
  'tempor nisi sed',
  'porta augue',
  'praesent nunc leo',
  'posuere non',
  'sollicitudin ut',
  'suscipit eu ipsum',
  'quisque at nisi ac',
  'mauris tempor maximus',
  'vel ut libero'
];

// Fisher–Yates
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    [array[i], array[r]] = [array[r], array[i]];
  }
}

let next_phrase = 0;
const upper = match => match.toUpperCase();
const capitalize = s => s.replace(/^(.)/, upper);

function rehashLoremIpsum() {
  const start = phrase_list.shift();
  shuffle(phrase_list);
  phrase_list.unshift(start);
}

function num_words(str) {
  let sp = str.match(/[ ]+/g);
  let wc = sp? sp.length + 1: 1;
  return wc;
}

function LoremIpsum(maxwords) {
  let str = '';
  let begin = true;
  for (let limit = maxwords; limit > 0; ) {
    let phrase = phrase_list[next_phrase++];
    next_phrase %= phrase_list.length;
    let wc = num_words(phrase);
    while (wc > limit) {
      phrase = phrase.replace(/[ ]+[a-zA-Z]+$/, '');
      wc = num_words(phrase);
    }
    if (begin) {
      if (str.length > 0) {
        str += '. ';
      }
      str += capitalize(phrase);
      begin = false;
    } else {
      str += Math.random() < 0.5? ' ': ', ';
      str += phrase;
      if (Math.random() < 0.3) {
        begin = true;
      }
    }
    limit -= wc;
  }
  if (maxwords > 4) {
    str += '.';
  }
  return str;
}
