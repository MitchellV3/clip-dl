import './style.css' // Import CSS, automatically handled during bundling
import { createRoot } from 'react-dom/client'
import Screenshot from './Screenshot'
import Clip from './Clip'
import { Provider } from "@/components/ui/provider"

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  cssInjectionMode: 'ui', // This configuration tells WXT to dynamically inject CSS into the page
  async main(ctx) {
    // Here we use Shadow Root mode to inject UI, which properly prevents our Tailwind CSS from "polluting" the webpage itself
    const ui = await createShadowRootUi(ctx, {
      name: 'inject-ui-app',
      position: 'inline',
      anchor: '#movie_player .ytp-right-controls-left', // The container element to inject into
      append(anchor, ui) {
        anchor.insertBefore(ui, anchor.firstChild) // Add to the leftmost position
      },
      onMount: (container) => {
        const app = document.createElement('div');
        container.append(app);
        const root = createRoot(app)
        root.render(
          <Provider>
            <div>
              <Screenshot />
              <Clip />
            </div>
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
