import { attrs, contains } from "@core-dom/element"
import { nextTick } from "@core-foundation/utils/fn"
import { createMachine, guards, Machine, preserve } from "@ui-machines/core"
import { trackPointerDown } from "../utils/pointer-down"
import { WithDOM } from "../utils/types"
import { dom, getElements } from "./menu.dom"

const { not } = guards

export type MenuMachine = Machine<MenuMachineContext, MenuMachineState>

export type MenuMachineContext = WithDOM<{
  disabled?: boolean
  activeId: string | null
  onSelect?: (value: string) => void
  parent: MenuMachine | null
  children: Record<string, MenuMachine>
  orientation: "horizontal" | "vertical"
}>

export type MenuMachineState = {
  value: "unknown" | "idle" | "open" | "close" | "open:temp"
}

export const menuMachine = createMachine<MenuMachineContext, MenuMachineState>(
  {
    id: "menu-machine",
    initial: "unknown",
    context: {
      pointerdownNode: null,
      orientation: "vertical",
      activeId: null,
      uid: "testing",
      parent: null,
      children: {},
    },
    on: {
      SET_PARENT: {
        actions: "setParent",
      },
      SET_CHILD: {
        actions: "setChild",
      },
      FORCE_CLOSE: "close",
      FORCE_OPEN: {
        target: "open",
        actions: "focusFirstItem",
      },
    },
    states: {
      unknown: {
        on: {
          SETUP: {
            target: "idle",
            actions: ["setId", "setOwnerDocument"],
          },
        },
      },

      idle: {
        on: {
          TRIGGER_CLICK: {
            target: "open",
            actions: "focusFirstItem",
          },
          TRIGGER_FOCUS: "close",
          TRIGGER_POINTEROVER: {
            cond: "isTriggerItem",
            target: "open:temp",
            actions: "focusItem",
          },
        },
      },

      "open:temp": {
        after: {
          200: "open",
        },
        on: {
          // TRIGGER_POINTERLEAVE: {
          //   cond: "isTriggerItem",
          //   target: "idle",
          // },
        },
      },

      close: {
        entry: ["clearActiveId", "focusButton", "clearPointerDownNode"],
        on: {
          TRIGGER_CLICK: {
            target: "open",
            actions: "focusFirstItem",
          },
          TRIGGER_POINTEROVER: {
            cond: "isTriggerItem",
            target: "open:temp",
          },
          TRIGGER_BLUR: "idle",
          ARROW_DOWN: {
            target: "open",
            actions: "focusFirstItem",
          },
          ARROW_UP: {
            target: "open",
            actions: "focusLastItem",
          },
        },
      },

      open: {
        activities: "trackPointerDown",
        entry: "focusMenu",
        on: {
          TRIGGER_CLICK: {
            cond: not("isTriggerItem"),
            target: "close",
          },
          ARROW_UP: {
            actions: "focusPrevItem",
          },
          ARROW_DOWN: {
            actions: "focusNextItem",
          },
          ARROW_LEFT: {
            cond: "isNested",
            target: "close",
            actions: "focusParentMenu",
          },
          HOME: {
            actions: "focusFirstItem",
          },
          END: {
            actions: "focusLastItem",
          },
          BLUR: "close",
          ARROW_RIGHT: {
            cond: "isTriggerActiveItem",
            actions: "openSubmenu",
          },
          ENTER: [
            {
              cond: "isTriggerActiveItem",
              actions: "openSubmenu",
            },
            {
              target: "close",
              actions: ["invokeOnSelect", "closeParentRecursively"],
            },
          ],
          ESCAPE: [
            {
              cond: "isNested",
              target: "close",
              actions: "closeParentRecursively",
            },
            { target: "close" },
          ],
          ITEM_POINTERMOVE: [
            {
              cond: not("isTriggerItem"),
              actions: ["focusItem", "focusMenu", "closeChildren"],
            },
            {
              cond: not("isMenuFocused"),
              actions: ["focusItem", "focusMenu"],
            },
            {
              actions: "focusItem",
            },
          ],
          ITEM_POINTERLEAVE: {
            cond: not("isTriggerActiveItem"),
            actions: "clearActiveId",
          },
          ITEM_CLICK: {
            cond: not("isTriggerActiveItem"),
            target: "close",
            actions: ["invokeOnSelect", "closeParentRecursively"],
          },
          TYPEAHEAD: {
            actions: "focusMatchedItem",
          },
          FOCUS_MENU: {
            actions: "focusMenu",
          },
        },
      },
    },
  },
  {
    guards: {
      isRtl: (context) => context.direction === "rtl",
      isHorizontal: (ctx) => ctx.orientation === "horizontal",
      isVertical: (ctx) => ctx.orientation === "vertical",
      isMenuFocused: (ctx) => {
        const { menu, activeElement } = getElements(ctx)
        return contains(menu, activeElement)
      },
      isTriggerItem: (_ctx, evt) => {
        const attr = attrs(evt.target)
        return attr.get("role") === "menuitem" && !!attr.has("aria-controls")
      },
      isTriggerActiveItem: (ctx) => {
        const { activeItem } = getElements(ctx)
        return !!attrs(activeItem).has("aria-controls")
      },
      isNested: (ctx) => ctx.parent !== null,
    },
    activities: {
      trackPointerDown,
    },
    actions: {
      setId: (ctx, evt) => {
        ctx.uid = evt.id
      },
      setOwnerDocument(ctx, evt) {
        ctx.doc = preserve(evt.doc)
      },
      clearActiveId(ctx) {
        ctx.activeId = null
      },
      clearPointerDownNode(ctx) {
        ctx.pointerdownNode = null
      },
      focusMenu(ctx) {
        const { menu } = getElements(ctx)
        nextTick(() => menu?.focus())
      },
      focusFirstItem(ctx) {
        const menuitems = dom(ctx)
        ctx.activeId = menuitems.first.id
      },
      focusLastItem(ctx) {
        const menuitems = dom(ctx)
        ctx.activeId = menuitems.last.id
      },
      focusNextItem(ctx) {
        const menuitems = dom(ctx)
        const next = menuitems.next(ctx.activeId ?? "")
        ctx.activeId = next?.id ?? null
      },
      focusPrevItem(ctx) {
        const menuitems = dom(ctx)
        const prev = menuitems.prev(ctx.activeId ?? "")
        ctx.activeId = prev?.id ?? null
      },
      invokeOnSelect(ctx) {
        ctx.onSelect?.(ctx.activeId ?? "")
      },
      focusItem(ctx, event) {
        ctx.activeId = event.target.id
      },
      focusButton(ctx) {
        const { trigger } = getElements(ctx)
        nextTick(() => trigger?.focus())
      },
      focusMatchedItem(ctx, evt) {
        const menuitems = dom(ctx)
        const node = menuitems.searchByKey(evt.key)
        ctx.activeId = node?.id ?? ctx.activeId
      },
      setParent(ctx, evt) {
        ctx.parent = preserve(evt.value)
      },
      setChild(ctx, evt) {
        ctx.children[evt.id] = preserve(evt.value)
      },
      closeChildren(ctx) {
        for (const child of Object.values(ctx.children)) {
          child.send("FORCE_CLOSE")
        }
      },
      closeParentRecursively(ctx) {
        let parent = ctx.parent
        while (parent) {
          parent.send("FORCE_CLOSE")
          parent = parent.state.context.parent
        }
      },
      openSubmenu(ctx) {
        const { activeItem } = getElements(ctx)
        const id = attrs(activeItem).get("data-uid")
        const child = id ? ctx.children[id] : null
        child?.send("FORCE_OPEN")
      },
      focusParentMenu(ctx) {
        const { parent } = ctx
        parent?.send("FOCUS_MENU")
      },
    },
  },
)
