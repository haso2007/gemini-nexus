// content/toolbar/view/utils.js

/**
 * Shared utility for positioning elements.
 */
export const viewUtils = {
    positionElement(el, rect, isLargerWindow, isPinned, mousePoint) {
        if (isPinned && el.classList.contains('visible')) return;

        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let width = el.offsetWidth;
        let height = el.offsetHeight;

        if (width === 0 || height === 0) {
            width = isLargerWindow ? 400 : 220;
            height = isLargerWindow ? 300 : 40;
        }

        const padding = 10;
        const offset = 12;

        let anchorX;
        let anchorY;

        if (mousePoint) {
            anchorX = mousePoint.x;
            anchorY = mousePoint.y;
        } else if (rect) {
            anchorX = rect.right;
            anchorY = rect.bottom;
        } else {
            anchorX = vw / 2;
            anchorY = vh / 2;
        }

        let visualLeft = anchorX + offset;
        let visualTop = anchorY + offset;

        if (visualLeft + width > vw - padding) {
            visualLeft = anchorX - width - offset;

            if (visualLeft < padding) {
                visualLeft = vw - width - padding;
            }
        }

        if (visualTop + height > vh - padding) {
            visualTop = anchorY - height - offset;

            if (!isLargerWindow) {
                el.classList.remove('placed-bottom');
                el.classList.add('placed-top');
            }

            if (visualTop < padding) {
                visualTop = vh - height - padding;
            }
        } else if (!isLargerWindow) {
            el.classList.remove('placed-top');
            el.classList.add('placed-bottom');
        }

        if (!isLargerWindow) {
            el.style.left = `${visualLeft + scrollX}px`;
            el.style.top = `${visualTop + scrollY}px`;
            return;
        }

        el.style.left = `${visualLeft}px`;
        el.style.top = `${visualTop}px`;
    },

    resizeSelect(select) {
        if (!select) return;

        const span = document.createElement('span');
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.style.fontSize = '13px';
        span.style.fontWeight = '500';
        span.style.fontFamily = window.getComputedStyle(select).fontFamily;
        span.style.whiteSpace = 'nowrap';
        span.textContent = select.options[select.selectedIndex].text;

        if (select.parentNode) {
            select.parentNode.appendChild(span);
            const width = span.getBoundingClientRect().width;
            select.parentNode.removeChild(span);
            select.style.width = `${width + 34}px`;
        }
    }
};
