/**
 * Scroll Animation Hooks
 * Framer Motion and GSAP integration for scroll-triggered animations
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useInView, useAnimation, Variants, motion } from 'framer-motion';
import { designTokens } from '../design-tokens';

// GSAP ScrollTrigger types (loaded dynamically)
interface ScrollTriggerInstance {
  kill: () => void;
  refresh: () => void;
  update: () => void;
}

interface GSAPPlugin {
  ScrollTrigger: {
    create: (config: any) => ScrollTriggerInstance;
    refresh: () => void;
    killAll: () => void;
  };
  gsap: {
    to: (target: any, vars: any) => any;
    from: (target: any, vars: any) => any;
    fromTo: (target: any, fromVars: any, toVars: any) => any;
    set: (target: any, vars: any) => any;
    timeline: (vars?: any) => any;
    registerPlugin: (plugin: any) => void;
    killTweensOf: (target: any) => void;
  };
}

// Load GSAP dynamically
let gsapInstance: GSAPPlugin | null = null;
let gsapLoadPromise: Promise<GSAPPlugin> | null = null;

const loadGSAP = async (): Promise<GSAPPlugin> => {
  if (gsapInstance) return gsapInstance;
  if (gsapLoadPromise) return gsapLoadPromise;
  
  gsapLoadPromise = (async () => {
    const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);
    
    gsap.registerPlugin(ScrollTrigger);
    gsapInstance = { gsap, ScrollTrigger };
    return gsapInstance;
  })();
  
  return gsapLoadPromise;
};

// Reduced motion detection
export const useReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return reducedMotion;
};

// Framer Motion scroll reveal hook
export const useScrollReveal = (
  options: {
    threshold?: number;
    rootMargin?: string;
    triggerOnce?: boolean;
    delay?: number;
    variant?: Variants;
  } = {}
) => {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    triggerOnce = true,
    delay = 0,
    variant,
  } = options;
  
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { 
    once: triggerOnce, 
      margin: rootMargin as any,
    amount: threshold,
  });
    const controls = useAnimation();
  
  const defaultVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 40,
      scale: 0.95,
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.7,
          ease: designTokens.animation.easings.easeOutExpo as any,
        delay,
      },
    },
  };
  
  useEffect(() => {
    if (isInView) {
        controls.start('visible');
    } else if (!triggerOnce) {
        controls.start('hidden');
    }
    }, [isInView, controls, triggerOnce]);
  
    return { ref, controls, variants: variant || defaultVariants, isInView };
};

// Staggered children reveal
export const useStaggerReveal = <T extends HTMLElement = HTMLDivElement>(
  itemCount: number,
  options: {
    threshold?: number;
    rootMargin?: string;
    staggerDelay?: number;
    delay?: number;
  } = {}
): {
  ref: React.RefObject<T | null>;
  controls: ReturnType<typeof useAnimation>;
  containerVariants: Variants;
  itemVariants: Variants;
  isInView: boolean;
} => {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', staggerDelay = 0.1, delay = 0 } = options;
  
  const ref = useRef<T>(null);
  const isInView = useInView(ref, { once: true, margin: rootMargin as any, amount: threshold });
  const controls = useAnimation();
  
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  };
  
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: designTokens.animation.easings.easeOutExpo as any,
      },
    },
  };
  
  useEffect(() => {
    if (isInView) {
      controls.start('visible');
    }
  }, [isInView, controls]);
  
  return { ref, controls, containerVariants, itemVariants, isInView };
};

// Parallax scroll hook (Framer Motion)
export const useParallax = (speed: number = 0.5) => {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const elementTop = rect.top;
      const elementHeight = rect.height;
      
      // Calculate how far the element has scrolled through the viewport
      const scrollProgress = (viewportHeight - elementTop) / (viewportHeight + elementHeight);
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
      
      setOffset((clampedProgress - 0.5) * speed * 200);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);
  
  return { ref, style: { transform: `translateY(${offset}px)` } };
};

// Magnetic hover effect hook (GSAP)
export const useMagnetic = <T extends HTMLElement = HTMLDivElement>(strength: number = 0.3): React.RefObject<T | null> => {
  const ref = useRef<T>(null);
  const reducedMotion = useReducedMotion();
  
  useEffect(() => {
    if (reducedMotion) return;
    
    const element = ref.current;
    if (!element) return;
    
    let gsap: GSAPPlugin | null = null;
    
    loadGSAP().then((loadedGsap) => {
      gsap = loadedGsap;
      
      const handleMouseMove = (e: MouseEvent) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        gsap!.gsap.to(element, {
          x: x * strength,
          y: y * strength,
          duration: 0.4,
          ease: 'power3.out',
        });
      };
      
      const handleMouseLeave = () => {
        gsap!.gsap.to(element, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.5)',
        });
      };
      
      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        element.removeEventListener('mousemove', handleMouseMove);
        element.removeEventListener('mouseleave', handleMouseLeave);
      };
    });
    
    return () => {
      if (gsap) {
        gsap.gsap.killTweensOf(element);
      }
    };
  }, [strength, reducedMotion]);
  
  return ref;
};

// Scroll progress hook
export const useScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollTop / docHeight);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return progress;
};

// Element scroll progress hook
export const useElementScrollProgress = (threshold: number = 0) => {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const elementTop = rect.top;
      const elementHeight = rect.height;
      
      const start = elementTop - viewportHeight + elementHeight * threshold;
      const end = elementTop + elementHeight * (1 - threshold);
      const total = end - start;
      
      const current = viewportHeight - elementTop;
      const calculatedProgress = Math.max(0, Math.min(1, current / total));
      
      setProgress(calculatedProgress);
      setIsVisible(calculatedProgress > 0 && calculatedProgress < 1);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);
  
  return { ref, progress, isVisible };
};

// GSAP ScrollTrigger hook for complex animations
export const useGSAPScrollTrigger = (
  animationFn: (gsap: GSAPPlugin['gsap'], ScrollTrigger: GSAPPlugin['ScrollTrigger']) => ScrollTriggerInstance | void,
  deps: any[] = []
) => {
  const reducedMotion = useReducedMotion();
  
  useEffect(() => {
    if (reducedMotion) return;
    
    let trigger: ScrollTriggerInstance | void;
    
    loadGSAP().then(({ gsap, ScrollTrigger }) => {
      trigger = animationFn(gsap, ScrollTrigger);
    });
    
    return () => {
      if (trigger && typeof trigger.kill === 'function') {
        trigger.kill();
      }
    };
  }, [reducedMotion, ...deps]);
};

// Text reveal animation hook
export const useTextReveal = (text: string, options: { delay?: number; stagger?: number } = {}) => {
  const { delay = 0, stagger = 0.03 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px 0px -50px 0px' as any });
  const controls = useAnimation();
  
  const variants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };
  
  const charVariants: Variants = {
    hidden: { opacity: 0, y: 20, rotateX: -90 },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.5,
        ease: designTokens.animation.easings.easeOutBack as any,
      },
    },
  };
  
  useEffect(() => {
    if (isInView) {
      controls.start('visible');
    }
  }, [isInView, controls]);
  
  // Split text into characters
  const chars = text.split('').map((char, i) => (
    <motion.span key={i} variants={charVariants}>{char === ' ' ? '\u00A0' : char}</motion.span>
  ));
  
  return { ref, controls, variants, chars };
};

// Counter animation hook
export const useCounter = (
  end: number,
  options: { 
    duration?: number; 
    delay?: number; 
    easing?: string;
    formatter?: (value: number) => string;
  } = {}
) => {
  const { duration = 2, delay = 0, easing = 'easeOutExpo', formatter = (v) => Math.round(v).toLocaleString() } = options;
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px 0px -50px 0px' as any });
  const [count, setCount] = useState<string>('0');
  const reducedMotion = useReducedMotion();
  
  useEffect(() => {
    if (!isInView) return;

    if (reducedMotion) {
      setCount(formatter(end));
      return;
    }

    let gsap: GSAPPlugin | null = null;
    const objRef = { current: { value: 0 } };

    loadGSAP().then((loadedGsap) => {
      gsap = loadedGsap;

      const obj = objRef.current;
      gsap.gsap.to(obj, {
        value: end,
        duration,
        delay,
        ease: easing,
        onUpdate: () => {
          setCount(formatter(obj.value));
        },
      });
    });

    return () => {
      if (gsap) {
        gsap.gsap.killTweensOf(objRef.current);
      }
    };
  }, [isInView, end, duration, delay, easing, formatter, reducedMotion]);
  
  return { ref, count };
};

// Viewport size hook
export const useViewport = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const updateSize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    updateSize();
    window.addEventListener('resize', updateSize, { passive: true });
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  return size;
};

// Breakpoint hook
export const useBreakpoint = () => {
  const { width } = useViewport();
  const breakpoints = designTokens.breakpoints;
  
  if (width < breakpoints.sm) return 'xs';
  if (width < breakpoints.md) return 'sm';
  if (width < breakpoints.lg) return 'md';
  if (width < breakpoints.xl) return 'lg';
  if (width < breakpoints['2xl']) return 'xl';
  return '2xl';
};

// Intersection observer hook for custom logic
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const ref = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
      ...options,
    });
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin, options.root]);
  
  return { ref, entry, isIntersecting: entry?.isIntersecting ?? false };
};

// Scroll direction hook
export const useScrollDirection = () => {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY) {
        setDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setDirection('up');
      }
      
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);
  
  return direction;
};

// Spring animation hook for Framer Motion
export const useSpring = (
  value: number,
  options: { stiffness?: number; damping?: number; mass?: number } = {}
) => {
  const { stiffness = 300, damping = 30, mass = 1 } = options;
  
  return {
    type: 'spring',
    stiffness,
    damping,
    mass,
    velocity: 0,
  } as const;
};

// Export all design tokens for easy access
export { designTokens } from '../design-tokens';