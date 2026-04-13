/**
 * Handles draggable window logic with edge snapping (docking).
 */
export class DragController {
    constructor(targetEl, handleEl, callbacks = {}) {
        this.target = targetEl;
        this.handle = handleEl;
        this.callbacks = callbacks;

        this.isDragging = false;
        this.isFixed = false;
        this.dragOffset = { x: 0, y: 0 };

        this.onDragMove = this.onDragMove.bind(this);
        this.onDragEnd = this.onDragEnd.bind(this);

        this.init();
    }

    init() {
        this.handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
            if (window.matchMedia("(max-width: 600px)").matches) return;

            e.preventDefault();
            this.startDrag(e.clientX, e.clientY);
        });

        this.handle.addEventListener('touchstart', (e) => {
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
            if (window.matchMedia("(max-width: 600px)").matches) return;

            const touch = e.touches[0];
            this.startDrag(touch.clientX, touch.clientY);
        }, { passive: true });
    }

    startDrag(clientX, clientY) {
        if (this.callbacks.onUndock) {
            this.callbacks.onUndock();
        }

        this.isDragging = true;

        const style = window.getComputedStyle(this.target);
        this.isFixed = style.position === 'fixed';

        const rect = this.target.getBoundingClientRect();
        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;

        this.target.classList.add('dragging');

        let initialLeft = rect.left;
        let initialTop = rect.top;

        if (!this.isFixed) {
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            initialLeft += scrollX;
            initialTop += scrollY;
        }

        this.target.style.left = `${initialLeft}px`;
        this.target.style.top = `${initialTop}px`;
        this.target.style.transform = 'none';
        this.target.style.right = 'auto';

        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);
        document.addEventListener('touchmove', this.onDragMove, { passive: false });
        document.addEventListener('touchend', this.onDragEnd);
    }

    onDragMove(e) {
        if (!this.isDragging) return;

        let clientX;
        let clientY;

        if (e.type === 'touchmove') {
            e.preventDefault();
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            e.preventDefault();
            clientX = e.clientX;
            clientY = e.clientY;
        }

        let newLeft = clientX - this.dragOffset.x;
        let newTop = clientY - this.dragOffset.y;

        if (!this.isFixed) {
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            newLeft += scrollX;
            newTop += scrollY;
        }

        this.target.style.left = `${newLeft}px`;
        this.target.style.top = `${newTop}px`;
    }

    onDragEnd() {
        this.isDragging = false;
        this.target.classList.remove('dragging');

        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
        document.removeEventListener('touchmove', this.onDragMove);
        document.removeEventListener('touchend', this.onDragEnd);

        this._checkDocking();
    }

    _checkDocking() {
        if (!this.callbacks.onSnap) return;

        const rect = this.target.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const threshold = 30;

        if (rect.left < threshold) {
            this.callbacks.onSnap('left', rect.top);
        } else if (rect.right > viewportWidth - threshold) {
            this.callbacks.onSnap('right', rect.top);
        }
    }

    reset() {
        this.target.classList.remove('dragging');
        this.target.style.transform = '';
    }
}
