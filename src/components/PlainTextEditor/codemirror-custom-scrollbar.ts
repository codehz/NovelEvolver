import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

import {
  ScrollbarController,
  scrollbarNativeHiddenClass,
  scrollbarOverlayRootClass,
  scrollbarThumbClassName,
  scrollbarTrackClass,
} from "@/lib/scrollbar";

function applyThumbPresentation(
  thumb: HTMLDivElement,
  snapshot: ReturnType<ScrollbarController["getSnapshot"]>,
  thumbMetrics: NonNullable<ReturnType<ScrollbarController["getSnapshot"]>["thumb"]>,
): void {
  thumb.style.height = `${thumbMetrics.thumbHeight}px`;
  thumb.style.transform = `translateY(${thumbMetrics.thumbOffset}px)`;
  thumb.className = scrollbarThumbClassName(snapshot);
}

class CodeMirrorCustomScrollbarPlugin {
  private readonly view: EditorView;
  private readonly controller: ScrollbarController;
  private readonly overlay: HTMLDivElement;
  private readonly track: HTMLDivElement;
  private readonly thumb: HTMLDivElement;
  private readonly onEditorMouseEnter: () => void;
  private readonly onEditorMouseLeave: () => void;
  private readonly onTrackWheel: (event: WheelEvent) => void;

  constructor(view: EditorView) {
    this.view = view;
    const scroller = view.scrollDOM;
    scroller.classList.add(scrollbarNativeHiddenClass);

    this.overlay = document.createElement("div");
    this.overlay.className = scrollbarOverlayRootClass;
    this.overlay.setAttribute("aria-hidden", "true");

    this.track = document.createElement("div");
    this.track.className = scrollbarTrackClass;

    this.thumb = document.createElement("div");

    this.track.appendChild(this.thumb);
    this.overlay.appendChild(this.track);
    view.dom.appendChild(this.overlay);

    this.controller = new ScrollbarController({
      viewport: scroller,
      onChange: () => {
        this.paint();
      },
    });

    this.onEditorMouseEnter = () => {
      this.controller.onAreaPointerEnter();
    };
    this.onEditorMouseLeave = () => {
      this.controller.onAreaPointerLeave();
    };
    view.dom.addEventListener("mouseenter", this.onEditorMouseEnter);
    view.dom.addEventListener("mouseleave", this.onEditorMouseLeave);

    this.track.addEventListener("pointerdown", (event) => {
      this.controller.onTrackPointerDown(event);
    });
    this.thumb.addEventListener("mouseenter", () => {
      this.controller.onThumbPointerEnter();
    });
    this.thumb.addEventListener("mouseleave", () => {
      this.controller.onThumbPointerLeave();
    });
    this.thumb.addEventListener("pointerdown", (event) => {
      this.controller.onThumbPointerDown(event);
    });

    this.onTrackWheel = (event) => {
      event.preventDefault();
      scroller.scrollTop += event.deltaY;
    };
    this.track.addEventListener("wheel", this.onTrackWheel, { passive: false });

    this.paint();
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.geometryChanged) {
      this.controller.refreshMetrics();
    }
  }

  destroy(): void {
    const { dom, scrollDOM } = this.view;
    dom.removeEventListener("mouseenter", this.onEditorMouseEnter);
    dom.removeEventListener("mouseleave", this.onEditorMouseLeave);
    this.track.removeEventListener("wheel", this.onTrackWheel);
    this.controller.destroy();
    this.overlay.remove();
    scrollDOM.classList.remove(...scrollbarNativeHiddenClass.split(/\s+/));
  }

  private paint(): void {
    const snapshot = this.controller.getSnapshot();
    const { thumb, metrics } = snapshot;

    if (!thumb || !metrics) {
      this.overlay.style.display = "none";
      return;
    }

    this.overlay.style.display = "";
    this.track.style.height = `${metrics.clientHeight}px`;
    applyThumbPresentation(this.thumb, snapshot, thumb);
  }
}

/** Custom overlay scrollbar synced to `view.scrollDOM` (not React). */
export const codeMirrorCustomScrollbarExtension = ViewPlugin.define(
  (view) => new CodeMirrorCustomScrollbarPlugin(view),
);
