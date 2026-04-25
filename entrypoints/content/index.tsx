import { createRoot } from 'react-dom/client'
import { createIntegratedUi } from 'wxt/utils/content-script-ui/integrated'
import Screenshot from './Screenshot'
import Clipper from './Clipper'
import { Provider } from "@/components/ui/provider"
import { Toaster } from "@/components/ui/toaster"

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  // Use manifest injection with integrated UI so imported CSS is applied to the page.
  // `cssInjectionMode: 'ui'` is intended for UI-scoped loading flows (eg shadow-root helpers).
  cssInjectionMode: 'manifest',
  async main(ctx) {
    // Mount controls inside YouTube's player controls.
    const controlsUi = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: '#movie_player .ytp-right-controls-left', // The container element to inject into
      append(anchor, wrapper) {
        anchor.insertBefore(wrapper, anchor.firstChild) // Add to the leftmost position
      },
      onMount: (wrapper) => {
        wrapper.className = 'clip-dl-ui-wrapper';
        const app = document.createElement('div');
        app.className = 'clip-dl-ui-root';
        wrapper.append(app);
        const root = createRoot(app)

        root.render(
          <Provider>
            <Screenshot />
            <Clipper />
          </Provider>
        )

        return root
      },
      onRemove: (root) => {
        root?.unmount()
      },
    })

    // Mount toast UI at the page root so it can overlay all content.
    const toastUi = createIntegratedUi(ctx, {
      position: 'overlay',
      alignment: 'top-right',
      zIndex: 2147483647,
      anchor: 'body',
      onMount: (wrapper) => {
        wrapper.className = 'clip-dl-toast-wrapper'
        const app = document.createElement('div')
        app.className = 'clip-dl-toast-root'
        wrapper.append(app)
        const root = createRoot(app)

        root.render(
          <Provider>
            <Toaster />
          </Provider>
        )

        return root
      },
      onRemove: (root) => {
        root?.unmount()
      },
    })

    controlsUi.mount()
    toastUi.mount()
  },
})
