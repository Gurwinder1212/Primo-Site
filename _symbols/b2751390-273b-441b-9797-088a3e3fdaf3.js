// Content 2 - Home - Updated August 20, 2024
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function set_custom_element_data(node, prop, value) {
    if (prop in node) {
        node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
    }
    else {
        attr(node, prop, value);
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function create_fragment(ctx) {
	let div4;
	let div3;
	let div0;
	let h30;
	let t0;
	let t1;
	let p0;
	let t2;
	let t3;
	let div1;
	let img0;
	let img0_src_value;
	let img0_alt_value;
	let t4;
	let img1;
	let img1_src_value;
	let img1_alt_value;
	let t5;
	let div2;
	let a0;
	let t6_value = /*action_button*/ ctx[0].label + "";
	let t6;
	let a0_href_value;
	let t7;
	let div10;
	let div9;
	let div8;
	let div6;
	let h31;
	let t8;
	let t9;
	let p1;
	let t10;
	let t11;
	let div5;
	let a1;
	let t12_value = /*action_button*/ ctx[0].label + "";
	let t12;
	let a1_href_value;
	let t13;
	let div7;
	let lottie_player;
	let lottie_player_src_value;
	let t14;
	let img2;
	let img2_src_value;
	let img2_alt_value;

	return {
		c() {
			div4 = element("div");
			div3 = element("div");
			div0 = element("div");
			h30 = element("h3");
			t0 = text(/*content_title*/ ctx[1]);
			t1 = space();
			p0 = element("p");
			t2 = text(/*content_paragraph_1*/ ctx[2]);
			t3 = space();
			div1 = element("div");
			img0 = element("img");
			t4 = space();
			img1 = element("img");
			t5 = space();
			div2 = element("div");
			a0 = element("a");
			t6 = text(t6_value);
			t7 = space();
			div10 = element("div");
			div9 = element("div");
			div8 = element("div");
			div6 = element("div");
			h31 = element("h3");
			t8 = text(/*content_title*/ ctx[1]);
			t9 = space();
			p1 = element("p");
			t10 = text(/*content_paragraph_1*/ ctx[2]);
			t11 = space();
			div5 = element("div");
			a1 = element("a");
			t12 = text(t12_value);
			t13 = space();
			div7 = element("div");
			lottie_player = element("lottie-player");
			t14 = space();
			img2 = element("img");
			this.h();
		},
		l(nodes) {
			div4 = claim_element(nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div0 = claim_element(div3_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h30 = claim_element(div0_nodes, "H3", { class: true });
			var h30_nodes = children(h30);
			t0 = claim_text(h30_nodes, /*content_title*/ ctx[1]);
			h30_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			p0 = claim_element(div0_nodes, "P", { class: true });
			var p0_nodes = children(p0);
			t2 = claim_text(p0_nodes, /*content_paragraph_1*/ ctx[2]);
			p0_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t3 = claim_space(div3_nodes);
			div1 = claim_element(div3_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);

			img0 = claim_element(div1_nodes, "IMG", {
				id: true,
				src: true,
				alt: true,
				class: true
			});

			div1_nodes.forEach(detach);
			t4 = claim_space(div3_nodes);

			img1 = claim_element(div3_nodes, "IMG", {
				id: true,
				src: true,
				alt: true,
				class: true
			});

			t5 = claim_space(div3_nodes);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			a0 = claim_element(div2_nodes, "A", { class: true, href: true });
			var a0_nodes = children(a0);
			t6 = claim_text(a0_nodes, t6_value);
			a0_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t7 = claim_space(nodes);
			div10 = claim_element(nodes, "DIV", { class: true });
			var div10_nodes = children(div10);
			div9 = claim_element(div10_nodes, "DIV", { class: true });
			var div9_nodes = children(div9);
			div8 = claim_element(div9_nodes, "DIV", { class: true });
			var div8_nodes = children(div8);
			div6 = claim_element(div8_nodes, "DIV", {});
			var div6_nodes = children(div6);
			h31 = claim_element(div6_nodes, "H3", { class: true });
			var h31_nodes = children(h31);
			t8 = claim_text(h31_nodes, /*content_title*/ ctx[1]);
			h31_nodes.forEach(detach);
			t9 = claim_space(div6_nodes);
			p1 = claim_element(div6_nodes, "P", { class: true });
			var p1_nodes = children(p1);
			t10 = claim_text(p1_nodes, /*content_paragraph_1*/ ctx[2]);
			p1_nodes.forEach(detach);
			t11 = claim_space(div6_nodes);
			div5 = claim_element(div6_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			a1 = claim_element(div5_nodes, "A", { class: true, href: true });
			var a1_nodes = children(a1);
			t12 = claim_text(a1_nodes, t12_value);
			a1_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			t13 = claim_space(div8_nodes);
			div7 = claim_element(div8_nodes, "DIV", { class: true });
			var div7_nodes = children(div7);

			lottie_player = claim_element(div7_nodes, "LOTTIE-PLAYER", {
				autoplay: true,
				loop: true,
				mode: true,
				class: true,
				src: true
			});

			children(lottie_player).forEach(detach);
			t14 = claim_space(div7_nodes);
			img2 = claim_element(div7_nodes, "IMG", { src: true, alt: true, class: true });
			div7_nodes.forEach(detach);
			div8_nodes.forEach(detach);
			div9_nodes.forEach(detach);
			div10_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h30, "class", "svelte-q0n2yy");
			attr(p0, "class", "p-large svelte-q0n2yy");
			attr(div0, "class", "section-container content svelte-q0n2yy");
			attr(img0, "id", "content-image-desktop");
			if (!src_url_equal(img0.src, img0_src_value = /*content_image_desktop*/ ctx[4].url)) attr(img0, "src", img0_src_value);
			attr(img0, "alt", img0_alt_value = /*content_image_desktop*/ ctx[4].alt);
			attr(img0, "class", "svelte-q0n2yy");
			attr(div1, "class", "content-image-wrapper svelte-q0n2yy");
			attr(img1, "id", "content-image-mobile");
			if (!src_url_equal(img1.src, img1_src_value = /*content_image_mobile*/ ctx[3].url)) attr(img1, "src", img1_src_value);
			attr(img1, "alt", img1_alt_value = /*content_image_mobile*/ ctx[3].alt);
			attr(img1, "class", "svelte-q0n2yy");
			attr(a0, "class", "primary-large-button svelte-q0n2yy");
			attr(a0, "href", a0_href_value = /*action_button*/ ctx[0].url);
			attr(div2, "class", "button-wrapper svelte-q0n2yy");
			attr(div3, "class", "wrapper svelte-q0n2yy");
			attr(div4, "class", "container none svelte-q0n2yy");
			attr(h31, "class", "svelte-q0n2yy");
			attr(p1, "class", "p-large svelte-q0n2yy");
			attr(a1, "class", "primary-large-button svelte-q0n2yy");
			attr(a1, "href", a1_href_value = /*action_button*/ ctx[0].url);
			attr(div5, "class", "button-wrapper svelte-q0n2yy");
			set_custom_element_data(lottie_player, "autoplay", "");
			set_custom_element_data(lottie_player, "loop", "");
			set_custom_element_data(lottie_player, "mode", "normal");
			set_custom_element_data(lottie_player, "class", "lottie svelte-q0n2yy");
			if (!src_url_equal(lottie_player.src, lottie_player_src_value = trianglesLottie)) set_custom_element_data(lottie_player, "src", lottie_player_src_value);
			if (!src_url_equal(img2.src, img2_src_value = /*content_image_desktop*/ ctx[4].url)) attr(img2, "src", img2_src_value);
			attr(img2, "alt", img2_alt_value = /*content_image_desktop*/ ctx[4].alt);
			attr(img2, "class", "svelte-q0n2yy");
			attr(div7, "class", "img-wrapper svelte-q0n2yy");
			attr(div8, "class", "section-container content svelte-q0n2yy");
			attr(div9, "class", "wrapper svelte-q0n2yy");
			attr(div10, "class", "container svelte-q0n2yy");
		},
		m(target, anchor) {
			insert_hydration(target, div4, anchor);
			append_hydration(div4, div3);
			append_hydration(div3, div0);
			append_hydration(div0, h30);
			append_hydration(h30, t0);
			append_hydration(div0, t1);
			append_hydration(div0, p0);
			append_hydration(p0, t2);
			append_hydration(div3, t3);
			append_hydration(div3, div1);
			append_hydration(div1, img0);
			append_hydration(div3, t4);
			append_hydration(div3, img1);
			append_hydration(div3, t5);
			append_hydration(div3, div2);
			append_hydration(div2, a0);
			append_hydration(a0, t6);
			insert_hydration(target, t7, anchor);
			insert_hydration(target, div10, anchor);
			append_hydration(div10, div9);
			append_hydration(div9, div8);
			append_hydration(div8, div6);
			append_hydration(div6, h31);
			append_hydration(h31, t8);
			append_hydration(div6, t9);
			append_hydration(div6, p1);
			append_hydration(p1, t10);
			append_hydration(div6, t11);
			append_hydration(div6, div5);
			append_hydration(div5, a1);
			append_hydration(a1, t12);
			append_hydration(div8, t13);
			append_hydration(div8, div7);
			append_hydration(div7, lottie_player);
			append_hydration(div7, t14);
			append_hydration(div7, img2);
		},
		p(ctx, [dirty]) {
			if (dirty & /*content_title*/ 2) set_data(t0, /*content_title*/ ctx[1]);
			if (dirty & /*content_paragraph_1*/ 4) set_data(t2, /*content_paragraph_1*/ ctx[2]);

			if (dirty & /*content_image_desktop*/ 16 && !src_url_equal(img0.src, img0_src_value = /*content_image_desktop*/ ctx[4].url)) {
				attr(img0, "src", img0_src_value);
			}

			if (dirty & /*content_image_desktop*/ 16 && img0_alt_value !== (img0_alt_value = /*content_image_desktop*/ ctx[4].alt)) {
				attr(img0, "alt", img0_alt_value);
			}

			if (dirty & /*content_image_mobile*/ 8 && !src_url_equal(img1.src, img1_src_value = /*content_image_mobile*/ ctx[3].url)) {
				attr(img1, "src", img1_src_value);
			}

			if (dirty & /*content_image_mobile*/ 8 && img1_alt_value !== (img1_alt_value = /*content_image_mobile*/ ctx[3].alt)) {
				attr(img1, "alt", img1_alt_value);
			}

			if (dirty & /*action_button*/ 1 && t6_value !== (t6_value = /*action_button*/ ctx[0].label + "")) set_data(t6, t6_value);

			if (dirty & /*action_button*/ 1 && a0_href_value !== (a0_href_value = /*action_button*/ ctx[0].url)) {
				attr(a0, "href", a0_href_value);
			}

			if (dirty & /*content_title*/ 2) set_data(t8, /*content_title*/ ctx[1]);
			if (dirty & /*content_paragraph_1*/ 4) set_data(t10, /*content_paragraph_1*/ ctx[2]);
			if (dirty & /*action_button*/ 1 && t12_value !== (t12_value = /*action_button*/ ctx[0].label + "")) set_data(t12, t12_value);

			if (dirty & /*action_button*/ 1 && a1_href_value !== (a1_href_value = /*action_button*/ ctx[0].url)) {
				attr(a1, "href", a1_href_value);
			}

			if (dirty & /*content_image_desktop*/ 16 && !src_url_equal(img2.src, img2_src_value = /*content_image_desktop*/ ctx[4].url)) {
				attr(img2, "src", img2_src_value);
			}

			if (dirty & /*content_image_desktop*/ 16 && img2_alt_value !== (img2_alt_value = /*content_image_desktop*/ ctx[4].alt)) {
				attr(img2, "alt", img2_alt_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div4);
			if (detaching) detach(t7);
			if (detaching) detach(div10);
		}
	};
}

const trianglesLottie = '{"nm":"Композиция 1","ddd":0,"h":600,"w":600,"meta":{"g":"@lottiefiles/toolkit-js 0.26.1"},"layers":[{"ty":4,"nm":"Слой-фигура 6","sr":1,"st":0,"op":300.00001221925,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-130,-236,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[218,142,0],"t":0,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[100.929,103.144,0],"t":41,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[160,62,0],"t":112,"ti":[0,0,0],"to":[0,0,0]},{"s":[218,142,0],"t":142.000005783779}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[0],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[90],"t":46},{"s":[0],"t":86.0000035028518}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Фигура 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Контур 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"v":[[-160,-256],[-132,-206],[-96,-250]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Заливка 1","c":{"a":0,"k":[0.9647,0.898,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":1},{"ty":4,"nm":"Слой-фигура 5","sr":1,"st":0,"op":300.00001221925,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[92,244,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[396,494,0],"t":0,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[414,550,0],"t":76,"ti":[0,0,0],"to":[0,0,0]},{"s":[396,494,0],"t":142.000005783779}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":0.97},"s":[0],"t":0},{"o":{"x":0.333,"y":-0.026},"i":{"x":0.667,"y":1},"s":[-90.515],"t":46},{"s":[0],"t":86.0000035028518}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Фигура 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Контур 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"v":[[66,218],[58,272],[128,248]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Заливка 1","c":{"a":0,"k":[0.9647,0.898,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":2},{"ty":4,"nm":"Слой-фигура 3","sr":1,"st":0,"op":300.00001221925,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[56,26,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[196,462,0],"t":0,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[74,546,0],"t":25,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[266.838,415.226,0],"t":99,"ti":[0,0,0],"to":[0,0,0]},{"s":[196,462,0],"t":142.000005783779}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[0],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[267],"t":46},{"s":[0],"t":86.0000035028518}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Фигура 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Контур 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"v":[[44,-24],[16,50],[92,38]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Заливка 1","c":{"a":0,"k":[0.9647,0.898,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":3},{"ty":4,"nm":"Слой-фигура 2","sr":1,"st":0,"op":300.00001221925,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[142,28,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[460,356,0],"t":0,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[518,430,0],"t":80,"ti":[0,0,0],"to":[0,0,0]},{"s":[460,356,0],"t":113.000004602584}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[0],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[113],"t":46},{"s":[0],"t":86.0000035028518}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Фигура 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Контур 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"v":[[190,-4],[96,2],[156,62]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Заливка 1","c":{"a":0,"k":[0.9647,0.898,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":4},{"ty":4,"nm":"Слой-фигура 7","sr":1,"st":0,"op":300.00001221925,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-138,114,0],"ix":1},"s":{"a":0,"k":[38.277,38.277,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[342,300,0],"t":0,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[518,228,0],"t":64,"ti":[0,0,0],"to":[0,0,0]},{"s":[342,300,0],"t":142.000005783779}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[92],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[44],"t":46},{"s":[92],"t":86.0000035028518}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Фигура 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Контур 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"v":[[-56,-84],[-154,92],[44,92]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Заливка 1","c":{"a":0,"k":[0.9647,0.898,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[-56.825,10.677],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-144.031,111.33],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":5},{"ty":4,"nm":"Слой-фигура 1","sr":1,"st":0,"op":300.00001221925,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-138,114,0],"ix":1},"s":{"a":0,"k":[64.4,64.4,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[174,288,0],"t":0,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[147.415,364.338,0],"t":27,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[110,284,0],"t":93,"ti":[0,0,0],"to":[0,0,0]},{"s":[174,288,0],"t":132.00000537647}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[0],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[110],"t":46},{"s":[0],"t":86.0000035028518}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Фигура 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Контур 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"v":[[-56,-84],[-154,92],[44,92]]},"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Заливка 1","c":{"a":0,"k":[0.9647,0.898,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[-56.825,10.677],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-144.031,111.33],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":6}],"v":"5.10.2","fr":29.9700012207031,"op":143.000005824509,"ip":0,"assets":[]}';

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { content } = $$props;
	let { action_button } = $$props;
	let { content_title } = $$props;
	let { content_paragraph_1 } = $$props;
	let { content_image_mobile } = $$props;
	let { content_image_desktop } = $$props;

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(5, props = $$props.props);
		if ('content' in $$props) $$invalidate(6, content = $$props.content);
		if ('action_button' in $$props) $$invalidate(0, action_button = $$props.action_button);
		if ('content_title' in $$props) $$invalidate(1, content_title = $$props.content_title);
		if ('content_paragraph_1' in $$props) $$invalidate(2, content_paragraph_1 = $$props.content_paragraph_1);
		if ('content_image_mobile' in $$props) $$invalidate(3, content_image_mobile = $$props.content_image_mobile);
		if ('content_image_desktop' in $$props) $$invalidate(4, content_image_desktop = $$props.content_image_desktop);
	};

	return [
		action_button,
		content_title,
		content_paragraph_1,
		content_image_mobile,
		content_image_desktop,
		props,
		content
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 5,
			content: 6,
			action_button: 0,
			content_title: 1,
			content_paragraph_1: 2,
			content_image_mobile: 3,
			content_image_desktop: 4
		});
	}
}

export { Component as default };
