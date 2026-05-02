import { createRoot } from 'react-dom/client'
import { createIntegratedUi } from 'wxt/utils/content-script-ui/integrated'
import Screenshot from './Screenshot'
import Clipper from './Clipper'
import { Provider } from "@/components/ui/provider"
import { Toaster } from "@/components/ui/toaster"

// Detect which platform we're on and get the appropriate anchor selector
function getControlsAnchorSelector(): string | null {
  const url = window.location.hostname;
  
  if (url.includes('youtube.com')) {
    return '#movie_player .ytp-right-controls-left';
  } else if (url.includes('twitch.tv')) {
    return '.player-controls__right-control-group';
  }
  
  return null;
}

export default defineContentScript({
  matches: ['https://www.youtube.com/*', 'https://www.twitch.tv/*'],
  // Use manifest injection with integrated UI so imported CSS is applied to the page.
  // `cssInjectionMode: 'ui'` is intended for UI-scoped loading flows (eg shadow-root helpers).
  cssInjectionMode: 'manifest',
  async main(ctx) {
    const controlsAnchor = getControlsAnchorSelector();
    if (!controlsAnchor) {
      console.warn('clip-dl: Unsupported platform');
      return;
    }

    // Mount controls inside the player controls.
    const controlsUi = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: controlsAnchor, // The container element to inject into
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
