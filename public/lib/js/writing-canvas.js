// writing-canvas.js — WritingCanvas ES Module
// Extracted from inline worksheet code, shared across all worksheets

export class WritingCanvas {
    constructor(container) {
        this.container = container;
        this.canvas = container.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.drawing = false;
        this.tool = 'pen';
        this.penWidth = 2;
        this.penColor = '#1a1a1a';
        this.textInput = null;
        this.history = [];
        this.historyIndex = -1;
        this.baseHeight = parseInt(container.dataset.h) || 80;

        this.setupCanvas();
        this.setupToolbar();
        this.bindEvents();
    }

    setupCanvas() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect.width;
        const h = this.baseHeight * 2;

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.scale(dpr, dpr);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.saveState();
    }

    setupToolbar() {
        const toolbar = this.container.querySelector('.canvas-toolbar');
        toolbar.innerHTML = `
            <button class="tool-btn active" data-tool="pen">&#9998; 펜</button>
            <button class="tool-btn" data-tool="eraser">&#9634; 지우개</button>
            <button class="tool-btn" data-tool="text">&#9998; 텍스트</button>
            <div class="pen-sizes">
                <div class="pen-size" data-size="1"><div class="dot" style="width:3px;height:3px;"></div></div>
                <div class="pen-size active" data-size="2"><div class="dot" style="width:5px;height:5px;"></div></div>
                <div class="pen-size" data-size="4"><div class="dot" style="width:8px;height:8px;"></div></div>
            </div>
            <div class="color-palette">
                <div class="color-dot active" data-color="#1a1a1a" style="background:#1a1a1a;" title="검정"></div>
                <div class="color-dot" data-color="#2563eb" style="background:#2563eb;" title="파랑"></div>
                <div class="color-dot" data-color="#ef4444" style="background:#ef4444;" title="빨강"></div>
                <div class="color-dot" data-color="#eab308" style="background:#eab308;" title="노랑"></div>
                <div class="color-dot" data-color="#ffffff" style="background:#ffffff;" title="흰색"></div>
            </div>
            <div class="spacer"></div>
            <button class="undo-btn">&#8630;</button>
            <button class="clear-btn">&#10005;</button>
        `;

        toolbar.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                toolbar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.tool = btn.dataset.tool;
            });
        });

        toolbar.querySelectorAll('.pen-size').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                toolbar.querySelectorAll('.pen-size').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.penWidth = parseInt(btn.dataset.size);
            });
        });

        toolbar.querySelectorAll('.color-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                toolbar.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                this.penColor = dot.dataset.color;
            });
        });

        toolbar.querySelector('.undo-btn').addEventListener('click', (e) => { e.preventDefault(); this.undo(); });
        toolbar.querySelector('.clear-btn').addEventListener('click', (e) => { e.preventDefault(); this.clear(); });

        // 펼치기/접기 토글 버튼
        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-toggle';
        toggleBtn.type = 'button';
        toggleBtn.innerHTML = '<span class="toggle-arrow">&#9660;</span><span class="toggle-text"> 펼치기</span>';
        toolbar.appendChild(toggleBtn);
        var self = this;
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            self.container.classList.toggle('collapsed');
            if (self.container.classList.contains('collapsed')) {
                toggleBtn.innerHTML = '<span class="toggle-arrow">&#9660;</span><span class="toggle-text"> 펼치기</span>';
            } else {
                toggleBtn.innerHTML = '<span class="toggle-arrow">&#9650;</span><span class="toggle-text"> 접기</span>';
            }
        });
    }

    bindEvents() {
        const opts = { passive: false };
        // Pointer events with passive:false for iOS Safari preventDefault() support
        this.canvas.addEventListener('pointerdown', (e) => this.startDraw(e), opts);
        this.canvas.addEventListener('pointermove', (e) => this.draw(e), opts);
        this.canvas.addEventListener('pointerup', (e) => this.endDraw(e));
        this.canvas.addEventListener('pointerleave', (e) => this.endDraw(e));
        this.canvas.addEventListener('pointercancel', (e) => this.endDraw(e));
        // iOS Safari: 터치 기본 동작(스크롤) 차단
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); }, opts);
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, opts);
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    startDraw(e) {
        e.preventDefault();
        if (this.tool === 'text') {
            const pos = this.getPos(e);
            this.startTextInput(pos);
            return;
        }
        this.canvas.setPointerCapture(e.pointerId);
        this.drawing = true;
        const pos = this.getPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);

        if (this.tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.penWidth * 10;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.penColor;
            this.ctx.lineWidth = this.penWidth;
        }
    }

    draw(e) {
        if (!this.drawing) return;
        e.preventDefault();
        const pos = this.getPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }

    endDraw(e) {
        if (!this.drawing) return;
        this.drawing = false;
        this.ctx.globalCompositeOperation = 'source-over';
        this.saveState();
    }
    startTextInput(pos) {
        if (this.textInput) this.commitText();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-input-overlay';
        input.style.left = pos.x + 'px';
        input.style.top = pos.y + 'px';
        input.style.color = this.penColor;
        this.container.style.position = 'relative';
        this.container.appendChild(input);
        input.focus();
        this.textInput = { el: input, x: pos.x, y: pos.y };
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.commitText(); }
        });
        input.addEventListener('blur', () => {
            setTimeout(() => this.commitText(), 100);
        });
    }

    commitText() {
        if (!this.textInput) return;
        const { el, x, y } = this.textInput;
        const text = el.value.trim();
        if (text) {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = this.penColor;
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText(text, x, y + 16);
            this.saveState();
        }
        el.remove();
        this.textInput = null;
    }


    saveState() {
        this.historyIndex++;
        this.history = this.history.slice(0, this.historyIndex);
        this.history.push(this.canvas.toDataURL());
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = this.history[this.historyIndex];
        }
    }

    clear() {
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
        this.saveState();
    }

    resize() {
        const saved = this.canvas.toDataURL();
        this.setupCanvas();
        const img = new Image();
        img.onload = () => { this.ctx.drawImage(img, 0, 0); };
        img.src = saved;
    }
}
