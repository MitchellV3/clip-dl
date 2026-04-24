import { createRoot } from 'react-dom/client'
import { createIntegratedUi } from 'wxt/utils/content-script-ui/integrated'
import Screenshot from './Screenshot'
import Clipper from './Clipper'
import { Provider } from "@/components/ui/provider"

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  // Use manifest injection with integrated UI so imported CSS is applied to the page.
  // `cssInjectionMode: 'ui'` is intended for UI-scoped loading flows (eg shadow-root helpers).
  cssInjectionMode: 'manifest',
  async main(ctx) {

    // Use integrated UI mode to allow portals (Chakra-UI popovers, shadcn dialogs) to work properly
    const ui = createIntegratedUi(ctx, {
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


    ui.mount()
  },
})
