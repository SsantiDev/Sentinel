import { useEffect, useRef } from 'react';
import './GalaxyBackground.css';

export function GalaxyBackground({ interactive = true, subtle = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let particles = [];
    const particleCount = subtle ? 60 : 140;
    const connectionDistance = subtle ? 120 : 160;
    const mouse = { x: null, y: null, radius: 200 };

    const handleMouseMove = (event) => {
      mouse.x = event.x;
      mouse.y = event.y;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    class Particle {
      constructor() {
        this.init();
      }

      init() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = subtle ? Math.random() * 1.5 + 0.5 : Math.random() * 2 + 0.5;
        this.speedX = Math.random() * (subtle ? 0.3 : 0.5) - (subtle ? 0.15 : 0.25);
        this.speedY = Math.random() * (subtle ? 0.3 : 0.5) - (subtle ? 0.15 : 0.25);
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;
      }

      draw() {
        ctx.fillStyle = subtle ? 'rgba(46, 204, 113, 0.15)' : 'rgba(46, 204, 113, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const init = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const connect = () => {
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * (subtle ? 0.1 : 0.25);
            ctx.strokeStyle = `rgba(46, 204, 113, ${opacity})`;
            ctx.lineWidth = subtle ? 0.4 : 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }

        if (interactive && mouse.x !== null) {
          const dxMouse = particles[a].x - mouse.x;
          const dyMouse = particles[a].y - mouse.y;
          const mouseDistance = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

          if (mouseDistance < mouse.radius) {
            const opacity = (1 - mouseDistance / mouse.radius) * 0.4;
            ctx.strokeStyle = `rgba(46, 204, 113, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }
    };

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      connect();
      animationFrameId = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
    }

    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [interactive, subtle]);

  return (
    <canvas
      ref={canvasRef}
      className={`galaxy-canvas ${subtle ? 'subtle' : ''}`}
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
    />
  );
}
