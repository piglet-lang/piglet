import { template as _$template } from "solid-js/web";
import { delegateEvents as _$delegateEvents } from "solid-js/web";
import { createComponent as _$createComponent } from "solid-js/web";
import { memo as _$memo } from "solid-js/web";
import { insert as _$insert } from "solid-js/web";
const _tmpl$ = /*#__PURE__*/_$template(`<button type="button">`),
  _tmpl$2 = /*#__PURE__*/_$template(`<div>`),
  _tmpl$3 = /*#__PURE__*/_$template(`<p>`);
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
function Counter() {
  const [count, setCount] = createSignal(1);
  const increment = () => setCount(count() + 1);
  return (() => {
    const _el$ = _tmpl$();
    _el$.$$click = increment;
    _$insert(_el$, count);
    return _el$;
  })();
}
function Foo() {
  const [count, setCount] = createSignal(1);
  return (() => {
    const _el$2 = _tmpl$2();
    _el$2.$$click = () => setCount(count() + 1);
    _$insert(_el$2, (() => {
      const _c$ = _$memo(() => count() % 2 == 0);
      return () => _c$() ? _$createComponent(Counter, {}) : (() => {
        const _el$3 = _tmpl$3();
        _$insert(_el$3, count);
        return _el$3;
      })();
    })());
    return _el$2;
  })();
}
render(() => _$createComponent(Foo, {}), document.getElementById("app"));
_$delegateEvents(["click"]);
