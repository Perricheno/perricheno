'use client';

import { useEffect, useRef } from 'react';

export default function UnderConstructionPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    let time = 0;
    
    // Настройки 3D сетки
    const cols = 55;
    const rows = 45;
    const spacing = 40;
    const FOV = 400;

    // Режимы: 'mesh' (обычная сетка) или 'ascii' (текстовый арт)
    let mode: 'mesh' | 'ascii' = 'mesh';
    let lastToggleTime = Date.now();

    const chars = " .,-~:;=!*#$@";

    // Получаем цвет из CSS-переменной (темы)
    const getThemeColor = () => {
      const computedStyle = getComputedStyle(document.body);
      const color = computedStyle.getPropertyValue('--foreground').trim();
      return color || '#1A1A1A'; // Фолбэк на темный цвет из globals.css
    };

    const render = () => {
      time += 0.02;
      
      // Переключаем режим каждые 4 секунды
      const now = Date.now();
      if (now - lastToggleTime > 4000) {
        mode = mode === 'mesh' ? 'ascii' : 'mesh';
        lastToggleTime = now;
      }

      const fgColor = getThemeColor();

      // Очистка
      ctx.clearRect(0, 0, width, height);
      
      // Вычисляем точки
      const points = [];
      for (let z = 0; z < rows; z++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
          const worldX = (x - cols / 2) * spacing;
          const worldZ = z * spacing;
          
          // Математика волны (Ландшафт)
          const worldY = Math.sin(x * 0.2 + time) * 60 + Math.cos(z * 0.2 + time) * 60;

          // 3D Проекция
          const cameraZ = worldZ + 150; // Отдаляем камеру
          const scale = FOV / (FOV + cameraZ);
          
          const px = worldX * scale + width / 2;
          const py = (worldY + 200) * scale + height / 3; // Опускаем сетку вниз экрана
          
          row.push({ px, py, worldY, scale });
        }
        points.push(row);
      }

      if (mode === 'mesh') {
        // Отрисовка обычной сетки (Линии)
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 1;
        // Делаем линии прозрачнее вдалеке
        ctx.globalAlpha = 0.3;

        ctx.beginPath();
        for (let z = 0; z < rows - 1; z++) {
          for (let x = 0; x < cols - 1; x++) {
            const p = points[z][x];
            const pRight = points[z][x + 1];
            const pBottom = points[z + 1][x];

            // Рисуем только те, что перед камерой
            if (p.scale > 0) {
              ctx.moveTo(p.px, p.py);
              ctx.lineTo(pRight.px, pRight.py);
              
              ctx.moveTo(p.px, p.py);
              ctx.lineTo(pBottom.px, pBottom.py);
            }
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;

      } else {
        // Отрисовка ASCII-арта
        ctx.fillStyle = fgColor;
        // Масштабируем размер шрифта по глубине
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let z = 0; z < rows; z++) {
          for (let x = 0; x < cols; x++) {
            const p = points[z][x];
            if (p.scale > 0) {
              // Выбираем символ в зависимости от высоты волны
              const charIndex = Math.floor(((p.worldY + 120) / 240) * chars.length);
              const safeIndex = Math.max(0, Math.min(chars.length - 1, charIndex));
              
              ctx.font = `${Math.max(4, p.scale * 14)}px monospace`;
              
              // Делаем символы вдалеке более прозрачными
              ctx.globalAlpha = Math.min(1, p.scale * 1.5);
              ctx.fillText(chars[safeIndex], p.px, p.py);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--background)] overflow-hidden">
      {/* Анимированный Canvas без фона */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Маленький текст внизу */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="text-[var(--muted)] text-xs md:text-sm font-medium tracking-[0.3em] uppercase opacity-60">
          under development
        </span>
      </div>
    </div>
  );
}
