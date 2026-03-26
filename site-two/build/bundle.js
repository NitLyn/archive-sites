
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
(function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
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
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    function attribute_to_object(attributes) {
        const result = {};
        for (const attribute of attributes) {
            result[attribute.name] = attribute.value;
        }
        return result;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
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
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
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
        flushing = false;
        seen_callbacks.clear();
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
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
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
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
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
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
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
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement === 'function') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                const { on_mount } = this.$$;
                this.$$.on_disconnect = on_mount.map(run).filter(is_function);
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            disconnectedCallback() {
                run_all(this.$$.on_disconnect);
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
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
        };
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }

    /* src/components/NavBar.svelte generated by Svelte v3.38.2 */

    const file$3 = "src/components/NavBar.svelte";

    function create_fragment$3(ctx) {
    	let header;
    	let div;
    	let ul;
    	let li0;
    	let a0;
    	let t0;
    	let t1;
    	let li1;
    	let a1;
    	let t2;
    	let t3;
    	let li2;
    	let a2;
    	let t4;
    	let t5;
    	let li3;
    	let a3;
    	let t6;
    	let t7;
    	let li4;
    	let a4;
    	let t8;

    	const block = {
    		c: function create() {
    			header = element("header");
    			div = element("div");
    			ul = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			t0 = text(/*label1*/ ctx[1]);
    			t1 = space();
    			li1 = element("li");
    			a1 = element("a");
    			t2 = text(/*label2*/ ctx[3]);
    			t3 = space();
    			li2 = element("li");
    			a2 = element("a");
    			t4 = text(/*label3*/ ctx[5]);
    			t5 = space();
    			li3 = element("li");
    			a3 = element("a");
    			t6 = text(/*label4*/ ctx[7]);
    			t7 = space();
    			li4 = element("li");
    			a4 = element("a");
    			t8 = text(/*label5*/ ctx[10]);
    			this.c = noop;
    			attr_dev(a0, "class", "active");
    			attr_dev(a0, "href", /*link1*/ ctx[0]);
    			add_location(a0, file$3, 75, 16, 1302);
    			add_location(li0, file$3, 75, 12, 1298);
    			attr_dev(a1, "class", /*class4*/ ctx[8]);
    			attr_dev(a1, "href", /*link2*/ ctx[2]);
    			add_location(a1, file$3, 76, 16, 1367);
    			add_location(li1, file$3, 76, 12, 1363);
    			attr_dev(a2, "href", /*link3*/ ctx[4]);
    			add_location(a2, file$3, 77, 16, 1432);
    			add_location(li2, file$3, 77, 12, 1428);
    			attr_dev(a3, "href", /*link4*/ ctx[6]);
    			add_location(a3, file$3, 78, 16, 1482);
    			add_location(li3, file$3, 78, 12, 1478);
    			attr_dev(a4, "class", "lele");
    			attr_dev(a4, "href", /*link5*/ ctx[9]);
    			add_location(a4, file$3, 79, 16, 1532);
    			add_location(li4, file$3, 79, 12, 1528);
    			add_location(ul, file$3, 74, 8, 1281);
    			attr_dev(div, "class", "nav");
    			add_location(div, file$3, 73, 4, 1255);
    			add_location(header, file$3, 72, 0, 1242);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div);
    			append_dev(div, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a0);
    			append_dev(a0, t0);
    			append_dev(ul, t1);
    			append_dev(ul, li1);
    			append_dev(li1, a1);
    			append_dev(a1, t2);
    			append_dev(ul, t3);
    			append_dev(ul, li2);
    			append_dev(li2, a2);
    			append_dev(a2, t4);
    			append_dev(ul, t5);
    			append_dev(ul, li3);
    			append_dev(li3, a3);
    			append_dev(a3, t6);
    			append_dev(ul, t7);
    			append_dev(ul, li4);
    			append_dev(li4, a4);
    			append_dev(a4, t8);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("nav-bar", slots, []);
    	const link1 = "/";
    	const label1 = "Home";
    	const class1 = "home";
    	const link2 = "updates.html";
    	const label2 = "Updates";
    	const link3 = "our-team.html";
    	const label3 = "Our Team";
    	const link4 = "about.html";
    	const label4 = "About";
    	const class4 = "abt.active";
    	const link5 = "index.html";
    	const label5 = "NitLyn Beta";
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<nav-bar> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		link1,
    		label1,
    		class1,
    		link2,
    		label2,
    		link3,
    		label3,
    		link4,
    		label4,
    		class4,
    		link5,
    		label5
    	});

    	return [
    		link1,
    		label1,
    		link2,
    		label2,
    		link3,
    		label3,
    		link4,
    		label4,
    		class4,
    		link5,
    		label5,
    		class1
    	];
    }

    class NavBar extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>ul{padding:17px;list-style-type:none;padding-left:10px;overflow:hidden;background-color:rgb(28, 28, 29);margin-top:0px;margin-left:7px;margin-right:7px;margin-bottom:5px;border-radius:20px}li{float:left}li a{display:block;color:white;text-align:center;padding:14px 16px;text-decoration:none}li a:hover{background-color:#111}.lele{position:relative;top:20px;position:absolute;right:40px;font-size:28px}.abt.active{color:blueviolet}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance$3,
    			create_fragment$3,
    			safe_not_equal,
    			{
    				link1: 0,
    				label1: 1,
    				class1: 11,
    				link2: 2,
    				label2: 3,
    				link3: 4,
    				label3: 5,
    				link4: 6,
    				label4: 7,
    				class4: 8,
    				link5: 9,
    				label5: 10
    			}
    		);

    		if (options) {
    			if (options.target) {
    				insert_dev(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return [
    			"link1",
    			"label1",
    			"class1",
    			"link2",
    			"label2",
    			"link3",
    			"label3",
    			"link4",
    			"label4",
    			"class4",
    			"link5",
    			"label5"
    		];
    	}

    	get link1() {
    		return this.$$.ctx[0];
    	}

    	set link1(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'link1'");
    	}

    	get label1() {
    		return this.$$.ctx[1];
    	}

    	set label1(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'label1'");
    	}

    	get class1() {
    		return this.$$.ctx[11];
    	}

    	set class1(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'class1'");
    	}

    	get link2() {
    		return this.$$.ctx[2];
    	}

    	set link2(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'link2'");
    	}

    	get label2() {
    		return this.$$.ctx[3];
    	}

    	set label2(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'label2'");
    	}

    	get link3() {
    		return this.$$.ctx[4];
    	}

    	set link3(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'link3'");
    	}

    	get label3() {
    		return this.$$.ctx[5];
    	}

    	set label3(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'label3'");
    	}

    	get link4() {
    		return this.$$.ctx[6];
    	}

    	set link4(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'link4'");
    	}

    	get label4() {
    		return this.$$.ctx[7];
    	}

    	set label4(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'label4'");
    	}

    	get class4() {
    		return this.$$.ctx[8];
    	}

    	set class4(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'class4'");
    	}

    	get link5() {
    		return this.$$.ctx[9];
    	}

    	set link5(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'link5'");
    	}

    	get label5() {
    		return this.$$.ctx[10];
    	}

    	set label5(value) {
    		throw new Error("<nav-bar>: Cannot set read-only property 'label5'");
    	}
    }

    customElements.define("nav-bar", NavBar);

    /* src/components/Downloads.svelte generated by Svelte v3.38.2 */

    const file$2 = "src/components/Downloads.svelte";

    function create_fragment$2(ctx) {
    	let div9;
    	let div2;
    	let div0;
    	let h30;
    	let t1;
    	let div1;
    	let p0;
    	let p1;
    	let a0;
    	let t4;
    	let div5;
    	let div3;
    	let h31;
    	let t6;
    	let div4;
    	let p2;
    	let p3;
    	let a1;
    	let t9;
    	let div8;
    	let div6;
    	let h32;
    	let t11;
    	let div7;
    	let p4;
    	let p5;
    	let a2;
    	let t14;
    	let a3;

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Windows Download";
    			t1 = space();
    			div1 = element("div");
    			p0 = element("p");
    			p0.textContent = "NitLyn File Compressor Beta v 1.0";
    			p1 = element("p");
    			a0 = element("a");
    			a0.textContent = "Download";
    			t4 = space();
    			div5 = element("div");
    			div3 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Mac OS Download";
    			t6 = space();
    			div4 = element("div");
    			p2 = element("p");
    			p2.textContent = "NitLyn File Compressor Beta v 1.0";
    			p3 = element("p");
    			a1 = element("a");
    			a1.textContent = "Download";
    			t9 = space();
    			div8 = element("div");
    			div6 = element("div");
    			h32 = element("h3");
    			h32.textContent = "Linux Download";
    			t11 = space();
    			div7 = element("div");
    			p4 = element("p");
    			p4.textContent = "NitLyn File Compressor Beta v 1.0";
    			p5 = element("p");
    			a2 = element("a");
    			a2.textContent = ".deb";
    			t14 = space();
    			a3 = element("a");
    			a3.textContent = ".rpm";
    			this.c = noop;
    			add_location(h30, file$2, 78, 20, 1455);
    			attr_dev(div0, "id", "windowsdownloadhead");
    			add_location(div0, file$2, 77, 12, 1403);
    			add_location(p0, file$2, 81, 16, 1560);
    			attr_dev(a0, "id", "windowsdownloadButton");
    			attr_dev(a0, "href", "");
    			attr_dev(a0, "onclick", "errWin()");
    			attr_dev(a0, "download", "");
    			add_location(a0, file$2, 83, 20, 1691);
    			add_location(p1, file$2, 81, 52, 1596);
    			attr_dev(div1, "id", "windowsdownloadbody");
    			add_location(div1, file$2, 80, 12, 1512);
    			attr_dev(div2, "id", "windowasdownload");
    			add_location(div2, file$2, 76, 4, 1363);
    			add_location(h31, file$2, 89, 12, 1876);
    			attr_dev(div3, "id", "macdownloadhead");
    			add_location(div3, file$2, 88, 8, 1836);
    			add_location(p2, file$2, 92, 8, 1952);
    			attr_dev(a1, "id", "macdownloadButton");
    			attr_dev(a1, "onclick", "mac()");
    			attr_dev(a1, "href", "");
    			attr_dev(a1, "download", "");
    			add_location(a1, file$2, 94, 12, 2067);
    			add_location(p3, file$2, 92, 44, 1988);
    			attr_dev(div4, "id", "macdownloadbody");
    			add_location(div4, file$2, 91, 4, 1916);
    			attr_dev(div5, "id", "macdownload");
    			add_location(div5, file$2, 87, 4, 1805);
    			add_location(h32, file$2, 100, 12, 2241);
    			attr_dev(div6, "id", "linuxdownloadhead");
    			add_location(div6, file$2, 99, 8, 2199);
    			add_location(p4, file$2, 103, 8, 2318);
    			attr_dev(a2, "id", "linuxdownloadButton");
    			attr_dev(a2, "href", "");
    			attr_dev(a2, "onclick", "deberr()");
    			attr_dev(a2, "download", "");
    			add_location(a2, file$2, 105, 12, 2433);
    			attr_dev(a3, "id", "linuxdownloadButton");
    			attr_dev(a3, "href", "");
    			attr_dev(a3, "onclick", "rpmerr()");
    			attr_dev(a3, "download", "");
    			add_location(a3, file$2, 106, 12, 2518);
    			add_location(p5, file$2, 103, 44, 2354);
    			attr_dev(div7, "id", "linuxdownloadbody");
    			add_location(div7, file$2, 102, 4, 2280);
    			attr_dev(div8, "id", "linuxdownload");
    			add_location(div8, file$2, 98, 4, 2166);
    			attr_dev(div9, "id", "wholedownload");
    			add_location(div9, file$2, 74, 0, 1304);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div2);
    			append_dev(div2, div0);
    			append_dev(div0, h30);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, p0);
    			append_dev(div1, p1);
    			append_dev(p1, a0);
    			append_dev(div9, t4);
    			append_dev(div9, div5);
    			append_dev(div5, div3);
    			append_dev(div3, h31);
    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div4, p2);
    			append_dev(div4, p3);
    			append_dev(p3, a1);
    			append_dev(div9, t9);
    			append_dev(div9, div8);
    			append_dev(div8, div6);
    			append_dev(div6, h32);
    			append_dev(div8, t11);
    			append_dev(div8, div7);
    			append_dev(div7, p4);
    			append_dev(div7, p5);
    			append_dev(p5, a2);
    			append_dev(p5, t14);
    			append_dev(p5, a3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("download-bttn", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<download-bttn> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Downloads extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>#wholedownload{color:aliceblue;display:grid;gap:1rem;margin-top:20rem;grid-template-columns:repeat(3, 1fr);grid-template-columns:repeat(3, minmax(20rem, 1fr));grid-template-columns:repeat(auto-fit, minmax(20rem, 1fr))}#windowsdownloadButton{background-color:DodgerBlue;border:none;color:white;padding:12px 30px;cursor:pointer;font-size:20px}#windowsdownloadButton:hover{background-color:RoyalBlue}#windowsdownloadbody,#windowsdownloadhead{text-align:center}#macdownloadButton{background-color:DodgerBlue;border:none;color:white;padding:12px 30px;cursor:pointer;font-size:20px}#macdownloadButton:hover{background-color:RoyalBlue}#macdownloadhead,#macdownloadbody{text-align:center}#linuxdownloadButton{background-color:DodgerBlue;border:none;color:white;padding:12px 30px;cursor:pointer;font-size:20px}#linuxdownloadButton:hover{background-color:RoyalBlue}#linuxdownloadbody,#linuxdownloadhead{text-align:center}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance$2,
    			create_fragment$2,
    			safe_not_equal,
    			{}
    		);

    		if (options) {
    			if (options.target) {
    				insert_dev(options.target, this, options.anchor);
    			}
    		}
    	}
    }

    customElements.define("download-bttn", Downloads);

    /* src/components/Footer.svelte generated by Svelte v3.38.2 */

    const file$1 = "src/components/Footer.svelte";

    function create_fragment$1(ctx) {
    	let footer;
    	let div;
    	let p;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			div = element("div");
    			p = element("p");
    			p.textContent = "NitLyn © 2021";
    			this.c = noop;
    			add_location(p, file$1, 22, 8, 286);
    			attr_dev(div, "class", "footer");
    			add_location(div, file$1, 21, 4, 257);
    			add_location(footer, file$1, 20, 0, 244);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, div);
    			append_dev(div, p);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("footer-con", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<footer-con> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>.footer{margin-top:5rem;text-align:center}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance$1,
    			create_fragment$1,
    			safe_not_equal,
    			{}
    		);

    		if (options) {
    			if (options.target) {
    				insert_dev(options.target, this, options.anchor);
    			}
    		}
    	}
    }

    customElements.define("footer-con", Footer);

    /* src/components/OurTeamCards.svelte generated by Svelte v3.38.2 */

    const file = "src/components/OurTeamCards.svelte";

    function create_fragment(ctx) {
    	let main;
    	let fieldset0;
    	let div0;
    	let h20;
    	let t1;
    	let div1;
    	let p0;
    	let t3;
    	let p1;
    	let t5;
    	let p2;
    	let t7;
    	let p3;
    	let t9;
    	let p4;
    	let t11;
    	let fieldset1;
    	let div2;
    	let h21;
    	let t13;
    	let div3;
    	let p5;
    	let t15;
    	let p6;
    	let t17;
    	let p7;
    	let t19;
    	let fieldset2;
    	let div4;
    	let h22;
    	let t21;
    	let div5;
    	let p8;
    	let t23;
    	let p9;
    	let t25;
    	let fieldset3;
    	let div6;
    	let h23;
    	let t27;
    	let div7;
    	let p10;
    	let t29;
    	let p11;

    	const block = {
    		c: function create() {
    			main = element("main");
    			fieldset0 = element("fieldset");
    			div0 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Julian Pitterson";
    			t1 = space();
    			div1 = element("div");
    			p0 = element("p");
    			p0.textContent = "Founder";
    			t3 = space();
    			p1 = element("p");
    			p1.textContent = "C.E.O";
    			t5 = space();
    			p2 = element("p");
    			p2.textContent = "Lead Developer";
    			t7 = space();
    			p3 = element("p");
    			p3.textContent = "Lead Designer";
    			t9 = space();
    			p4 = element("p");
    			p4.textContent = "Majority Share Holder in NitLyn";
    			t11 = space();
    			fieldset1 = element("fieldset");
    			div2 = element("div");
    			h21 = element("h2");
    			h21.textContent = "James Batara";
    			t13 = space();
    			div3 = element("div");
    			p5 = element("p");
    			p5.textContent = "Co-Founder";
    			t15 = space();
    			p6 = element("p");
    			p6.textContent = "C.T.O";
    			t17 = space();
    			p7 = element("p");
    			p7.textContent = "Majority Share Holder in NitLyn";
    			t19 = space();
    			fieldset2 = element("fieldset");
    			div4 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Ryan George";
    			t21 = space();
    			div5 = element("div");
    			p8 = element("p");
    			p8.textContent = "Developer";
    			t23 = space();
    			p9 = element("p");
    			p9.textContent = "Asst. Designer";
    			t25 = space();
    			fieldset3 = element("fieldset");
    			div6 = element("div");
    			h23 = element("h2");
    			h23.textContent = "Darwin Garcia";
    			t27 = space();
    			div7 = element("div");
    			p10 = element("p");
    			p10.textContent = "Asst. Developer";
    			t29 = space();
    			p11 = element("p");
    			p11.textContent = "Designer";
    			this.c = noop;
    			add_location(h20, file, 34, 12, 686);
    			attr_dev(div0, "class", "head");
    			add_location(div0, file, 33, 8, 655);
    			add_location(p0, file, 37, 12, 766);
    			add_location(p1, file, 38, 12, 793);
    			add_location(p2, file, 39, 12, 818);
    			add_location(p3, file, 40, 12, 852);
    			add_location(p4, file, 41, 12, 885);
    			attr_dev(div1, "class", "body");
    			add_location(div1, file, 36, 8, 735);
    			attr_dev(fieldset0, "class", "card julian");
    			add_location(fieldset0, file, 32, 4, 616);
    			add_location(h21, file, 48, 12, 1106);
    			attr_dev(div2, "class", "head");
    			add_location(div2, file, 47, 8, 1075);
    			add_location(p5, file, 51, 12, 1182);
    			add_location(p6, file, 52, 12, 1212);
    			add_location(p7, file, 53, 12, 1237);
    			attr_dev(div3, "class", "body");
    			add_location(div3, file, 50, 8, 1151);
    			attr_dev(fieldset1, "class", "card james");
    			add_location(fieldset1, file, 46, 4, 1037);
    			add_location(h22, file, 59, 12, 1380);
    			attr_dev(div4, "class", "head");
    			add_location(div4, file, 58, 8, 1349);
    			add_location(p8, file, 62, 12, 1455);
    			add_location(p9, file, 63, 12, 1484);
    			attr_dev(div5, "class", "body");
    			add_location(div5, file, 61, 8, 1424);
    			attr_dev(fieldset2, "class", "card ryan");
    			add_location(fieldset2, file, 57, 4, 1312);
    			add_location(h23, file, 70, 12, 1613);
    			attr_dev(div6, "class", "head");
    			add_location(div6, file, 69, 8, 1582);
    			add_location(p10, file, 73, 12, 1690);
    			add_location(p11, file, 74, 12, 1725);
    			attr_dev(div7, "class", "body");
    			add_location(div7, file, 72, 8, 1659);
    			attr_dev(fieldset3, "class", "card darwin");
    			add_location(fieldset3, file, 68, 4, 1543);
    			add_location(main, file, 31, 0, 605);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, fieldset0);
    			append_dev(fieldset0, div0);
    			append_dev(div0, h20);
    			append_dev(fieldset0, t1);
    			append_dev(fieldset0, div1);
    			append_dev(div1, p0);
    			append_dev(div1, t3);
    			append_dev(div1, p1);
    			append_dev(div1, t5);
    			append_dev(div1, p2);
    			append_dev(div1, t7);
    			append_dev(div1, p3);
    			append_dev(div1, t9);
    			append_dev(div1, p4);
    			append_dev(main, t11);
    			append_dev(main, fieldset1);
    			append_dev(fieldset1, div2);
    			append_dev(div2, h21);
    			append_dev(fieldset1, t13);
    			append_dev(fieldset1, div3);
    			append_dev(div3, p5);
    			append_dev(div3, t15);
    			append_dev(div3, p6);
    			append_dev(div3, t17);
    			append_dev(div3, p7);
    			append_dev(main, t19);
    			append_dev(main, fieldset2);
    			append_dev(fieldset2, div4);
    			append_dev(div4, h22);
    			append_dev(fieldset2, t21);
    			append_dev(fieldset2, div5);
    			append_dev(div5, p8);
    			append_dev(div5, t23);
    			append_dev(div5, p9);
    			append_dev(main, t25);
    			append_dev(main, fieldset3);
    			append_dev(fieldset3, div6);
    			append_dev(div6, h23);
    			append_dev(fieldset3, t27);
    			append_dev(fieldset3, div7);
    			append_dev(div7, p10);
    			append_dev(div7, t29);
    			append_dev(div7, p11);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ourteam-cards", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ourteam-cards> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class OurTeamCards extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>main{display:grid;gap:1rem;margin-top:2rem;grid-template-columns:repeat(3, 1fr);grid-template-columns:repeat(3, minmax(20rem, 1fr));grid-template-columns:repeat(auto-fit, minmax(20rem, 1fr))}.card{border:none;color:black;font-size:small;border-radius:10px;background-color:white}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{}
    		);

    		if (options) {
    			if (options.target) {
    				insert_dev(options.target, this, options.anchor);
    			}
    		}
    	}
    }

    customElements.define("ourteam-cards", OurTeamCards);

}());
//# sourceMappingURL=bundle.js.map
