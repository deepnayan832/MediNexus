/**
 * Glassmorphism / Liquid Glass Components
 * Premium glass effects for MediNexus
 */

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { designTokens } from '../../design-tokens';

// Glass variants
export type GlassVariant = 'default' | 'strong' | 'subtle' | 'liquid' | 'frosted';
export type GlassElevation = 1 | 2 | 3 | 4 | 5;

interface GlassProps extends HTMLMotionProps<'div'> {
  variant?: GlassVariant;
  elevation?: GlassElevation;
  interactive?: boolean;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Glass style generator
const getGlassStyles = (variant: GlassVariant, elevation: GlassElevation, isDark: boolean) => {
  const base = designTokens.effects.glass;
  const elevationStyles = designTokens.effects.glass.elevation[elevation];
  
  const variants = {
    default: {
      background: isDark ? base.backgroundDark : base.backgroundLight,
      border: isDark ? base.borderDark : base.borderLight,
      backdropFilter: base.backdropFilter,
      WebkitBackdropFilter: base.webkitBackdropFilter,
      boxShadow: elevationStyles.shadow,
    },
    strong: {
      background: isDark 
        ? 'rgba(10, 26, 47, 0.9)' 
        : 'rgba(255, 255, 255, 0.85)',
      border: isDark 
        ? 'rgba(25, 197, 209, 0.3)' 
        : 'rgba(25, 197, 209, 0.2)',
      backdropFilter: 'blur(32px) saturate(200%)',
      WebkitBackdropFilter: 'blur(32px) saturate(200%)',
      boxShadow: elevationStyles.shadow,
    },
    subtle: {
      background: isDark 
        ? 'rgba(10, 26, 47, 0.4)' 
        : 'rgba(255, 255, 255, 0.4)',
      border: isDark 
        ? 'rgba(255, 255, 255, 0.05)' 
        : 'rgba(0, 0, 0, 0.04)',
      backdropFilter: 'blur(16px) saturate(150%)',
      WebkitBackdropFilter: 'blur(16px) saturate(150%)',
      boxShadow: elevationStyles.shadow,
    },
    liquid: {
      background: isDark 
        ? 'linear-gradient(135deg, rgba(25, 197, 209, 0.15) 0%, rgba(117, 97, 238, 0.1) 50%, rgba(55, 211, 174, 0.15) 100%)'
        : 'linear-gradient(135deg, rgba(25, 197, 209, 0.1) 0%, rgba(117, 97, 238, 0.08) 50%, rgba(55, 211, 174, 0.1) 100%)',
      border: isDark 
        ? 'rgba(25, 197, 209, 0.4)' 
        : 'rgba(25, 197, 209, 0.25)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      boxShadow: `
        ${elevationStyles.shadow},
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1)
      `,
    },
    frosted: {
      background: isDark 
        ? 'rgba(15, 30, 55, 0.7)' 
        : 'rgba(248, 250, 252, 0.7)',
      border: isDark 
        ? 'rgba(255, 255, 255, 0.08)' 
        : 'rgba(0, 0, 0, 0.06)',
      backdropFilter: 'blur(40px) saturate(150%)',
      WebkitBackdropFilter: 'blur(40px) saturate(150%)',
      boxShadow: elevationStyles.shadow,
    },
  };
  
  return variants[variant];
};

// GlassCard - Main glass container component
export const GlassCard = forwardRef<HTMLDivElement, GlassProps>(
  ({ 
    variant = 'default', 
    elevation = 2, 
    interactive = false, 
    children, 
    className = '', 
    style = {},
    ...props 
  }, ref) => {
    const [isDark, setIsDark] = useState(() => {
      if (typeof window !== 'undefined') {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }
      return true;
    });
    
    useEffect(() => {
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      return () => observer.disconnect();
    }, []);
    
    const glassStyles = getGlassStyles(variant, elevation, isDark);
    
    const combinedStyle: React.CSSProperties = {
          ...glassStyles,
          borderRadius: designTokens.borderRadius.xl,
          ...style,
        };
    
    if (interactive) {
      return (
        <motion.div
          ref={ref}
          className={className}
          style={combinedStyle}
          whileHover={{
            y: -4,
            boxShadow: elevation === 5 
              ? designTokens.effects.glass.elevation[5].shadow 
                      : designTokens.effects.glass.elevation[(elevation + 1) as GlassElevation].shadow,
                    transition: {
                      duration: parseFloat(designTokens.animation.durations.normal) / 1000,
                      ease: designTokens.animation.easings.easeOut as any,
                    },
                  }}
                  whileTap={{ scale: 0.98 }}
                  {...props}
                >
          {children}
        </motion.div>
      );
    }
    
    return (
          <div ref={ref} className={className} style={combinedStyle}>
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

// GlassPanel - Larger glass panel for sections
export const GlassPanel = forwardRef<HTMLDivElement, GlassProps>(
  ({ 
    variant = 'frosted', 
    elevation = 3, 
    children, 
    className = '', 
    style = {},
    ...props 
  }, ref) => {
    const [isDark, setIsDark] = useState(() => {
      if (typeof window !== 'undefined') {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }
      return true;
    });
    
    useEffect(() => {
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      return () => observer.disconnect();
    }, []);
    
    const glassStyles = getGlassStyles(variant, elevation, isDark);
    
    return (
          <div
            ref={ref}
            className={className}
            style={{
              ...glassStyles,
              borderRadius: designTokens.borderRadius['2xl'],
              ...style,
            }}
          >
            {children}
          </div>
        );
  }
);

GlassPanel.displayName = 'GlassPanel';

// GlassNav - Navigation bar with glass effect
export const GlassNav = forwardRef<HTMLElement, GlassProps & {
  blur?: boolean;
  sticky?: boolean;
  leftContent?: ReactNode;
  centerContent?: ReactNode;
  rightContent?: ReactNode;
}>(
  ({
    variant = 'frosted',
    elevation = 4,
    blur = true,
    sticky = true,
    leftContent,
    centerContent,
    rightContent,
    children,
    className = '',
    style = {},
    ...props
  }, ref) => {
    const [isDark, setIsDark] = useState(() => {
      if (typeof window !== 'undefined') {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }
      return true;
    });
    
    const [scrolled, setScrolled] = useState(false);
    
    useEffect(() => {
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      return () => observer.disconnect();
    }, []);
    
    useEffect(() => {
      const handleScroll = () => {
        setScrolled(window.scrollY > 20);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    const glassStyles = getGlassStyles(variant, elevation, isDark);
    
    return (
          <motion.nav
            ref={ref}
            className={className}
            style={{
              ...glassStyles,
              borderRadius: sticky ? 0 : designTokens.borderRadius.xl,
              borderTopLeftRadius: sticky ? 0 : designTokens.borderRadius.xl,
              borderTopRightRadius: sticky ? 0 : designTokens.borderRadius.xl,
              position: sticky ? 'sticky' : 'relative',
              top: sticky ? 0 : 'auto',
              zIndex: designTokens.zIndex.sticky,
              backdropFilter: blur ? glassStyles.backdropFilter : 'none',
              WebkitBackdropFilter: blur ? glassStyles.WebkitBackdropFilter : 'none',
              borderBottom: scrolled || !sticky ? glassStyles.border : 'none',
              boxShadow: scrolled ? glassStyles.boxShadow : 'none',
              ...style,
            }}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: parseFloat(designTokens.animation.durations.normal) / 1000,
              ease: designTokens.animation.easings.easeOut as any,
            }}
            {...props}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>{leftContent}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>{centerContent}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>{rightContent}</div>
            </div>
            {children}
          </motion.nav>
        );
  }
);

GlassNav.displayName = 'GlassNav';

// GlassButton - Interactive glass button
interface GlassButtonProps extends HTMLMotionProps<'button'> {
  variant?: GlassVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ 
    variant = 'liquid', 
    size = 'md', 
    isLoading = false, 
    leftIcon, 
    rightIcon, 
    children, 
    className = '', 
    style = {},
    disabled,
    ...props 
  }, ref) => {
    const [isDark, setIsDark] = useState(() => {
      if (typeof window !== 'undefined') {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }
      return true;
    });
    
    useEffect(() => {
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      return () => observer.disconnect();
    }, []);
    
    const glassStyles = getGlassStyles(variant, 2, isDark);
    
    const sizeStyles = {
          sm: { padding: '8px 16px', fontSize: designTokens.typography.fontSizes.sm, gap: '6px' },
          md: { padding: '12px 24px', fontSize: designTokens.typography.fontSizes.base, gap: '8px' },
          lg: { padding: '16px 32px', fontSize: designTokens.typography.fontSizes.lg, gap: '10px' },
    };
    
    return (
          <motion.button
            ref={ref}
            className={className}
            disabled={disabled || isLoading}
            style={{
              ...glassStyles,
              ...sizeStyles[size],
              borderRadius: designTokens.borderRadius.full,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: sizeStyles[size].gap,
              fontWeight: designTokens.typography.fontWeights.medium,
              color: isDark ? designTokens.colors.text.inverse : designTokens.colors.text.primary,
              border: 'none',
              cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
              opacity: disabled || isLoading ? 0.6 : 1,
              ...style,
            }}
                          transition={{ duration: 0.15, ease: designTokens.animation.easings.easeOut as any }}
            whileHover={{
              y: -2,
              boxShadow: designTokens.effects.glass.elevation[3].shadow,
              scale: 1.02,
            }}
            whileTap={{ scale: 0.96 }}
            {...props}
          >
        {isLoading ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        ) : (
          <>
            {leftIcon && <span style={{ display: 'flex' }}>{leftIcon}</span>}
            {children}
            {rightIcon && <span style={{ display: 'flex' }}>{rightIcon}</span>}
          </>
        )}
                        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

// GlassInput - Glass-styled input
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ 
    label, 
    error, 
    helperText, 
    leftIcon, 
    rightIcon, 
    className = '', 
    style = {},
    id,
    ...props 
  }, ref) => {
    const [isDark, setIsDark] = useState(() => {
      if (typeof window !== 'undefined') {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }
      return true;
    });
    
    const [focused, setFocused] = useState(false);
    
    useEffect(() => {
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      return () => observer.disconnect();
    }, []);
    
    const inputId = id || `glass-input-${Math.random().toString(36).substr(2, 9)}`;
        const glassStyles = getGlassStyles('subtle', 1, isDark);

        return (
          <div className={className} style={{ width: '100%', ...style }}>
            {label && (
              <label
                htmlFor={inputId}
                style={{
                  display: 'block',
                  marginBottom: designTokens.spacing.sm,
                  fontSize: designTokens.typography.fontSizes.sm,
                  fontWeight: designTokens.typography.fontWeights.medium,
                  color: isDark ? designTokens.colors.text.secondary : designTokens.colors.text.primary,
                }}
              >
                {label}
              </label>
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              {leftIcon && (
                <span style={{
                  position: 'absolute',
                  left: designTokens.spacing.md,
                  color: isDark ? designTokens.colors.text.muted : designTokens.colors.text.muted,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}>
                  {leftIcon}
                </span>
              )}
              <input
                ref={ref}
                id={inputId}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                  ...glassStyles,
                  borderRadius: designTokens.borderRadius.lg,
                  padding: leftIcon
                    ? `${designTokens.spacing.md} ${designTokens.spacing.lg} ${designTokens.spacing.md} ${designTokens.spacing['4xl']}`
                    : designTokens.spacing.md,
                  paddingRight: rightIcon ? designTokens.spacing['4xl'] : designTokens.spacing.lg,
                  width: '100%',
                  fontSize: designTokens.typography.fontSizes.base,
                  fontFamily: designTokens.typography.fontFamilies.body,
                  color: isDark ? designTokens.colors.text.inverse : designTokens.colors.text.primary,
                  background: focused
                    ? (isDark ? 'rgba(25, 197, 209, 0.05)' : 'rgba(25, 197, 209, 0.03)')
                    : glassStyles.background,
                  borderColor: error
                    ? designTokens.colors.semantic.error
                    : focused
                      ? designTokens.colors.brand.primary
                      : glassStyles.border,
                  boxShadow: focused
                    ? `0 0 0 3px ${isDark ? 'rgba(25, 197, 209, 0.2)' : 'rgba(25, 197, 209, 0.15)'}, ${glassStyles.boxShadow}`
                    : glassStyles.boxShadow,
                  outline: 'none',
                                    transition: designTokens.transitions.fast,
                                  }}
                {...props}
              />
          {rightIcon && (
            <span style={{
              position: 'absolute',
              right: designTokens.spacing.md,
              color: isDark ? designTokens.colors.text.muted : designTokens.colors.text.muted,
              pointerEvents: 'none',
              zIndex: 1,
            }}>
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p style={{
                          marginTop: designTokens.spacing.xs,
                          fontSize: designTokens.typography.fontSizes.sm,
            color: designTokens.colors.semantic.error,
            display: 'flex',
            alignItems: 'center',
                          gap: designTokens.spacing.xs,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p style={{
                          marginTop: designTokens.spacing.xs,
                          fontSize: designTokens.typography.fontSizes.sm,
            color: isDark ? designTokens.colors.text.muted : designTokens.colors.text.muted,
          }}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

// GlassModal - Glass modal overlay
interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export function GlassModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md', 
  className = '' 
}: GlassModalProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return true;
  });
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  
  if (!isOpen) return null;
  
  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  };
  
  const glassStyles = getGlassStyles('frosted', 5, isDark);
  
  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: designTokens.zIndex.modal,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: designTokens.spacing.lg,
          background: isDark
            ? 'rgba(0, 0, 0, 0.6)'
            : 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className={className}
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, ease: designTokens.animation.easings.easeOut as any }}
          style={{
            ...glassStyles,
            borderRadius: designTokens.borderRadius['2xl'],
            width: '100%',
            maxWidth: size === 'full' ? '90vw' : undefined,
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {(title || onClose !== undefined) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: designTokens.spacing.lg,
              borderBottom: `1px solid ${glassStyles.border}`,
            }}>
              {title && (
                <h2 id="modal-title" style={{
                  margin: 0,
                  fontSize: designTokens.typography.fontSizes.xl,
                  fontWeight: designTokens.typography.fontWeights.semibold,
                  color: isDark ? designTokens.colors.text.inverse : designTokens.colors.text.primary,
                }}>
                  {title}
                </h2>
              )}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? designTokens.colors.text.secondary : designTokens.colors.text.secondary,
                  cursor: 'pointer',
                  padding: designTokens.spacing.sm,
                  borderRadius: designTokens.borderRadius.full,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: designTokens.transitions.fast,
                }}
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </motion.button>
            </div>
          )}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: designTokens.spacing.lg,
          }}>
            {children}
          </div>
        </motion.div>
    </motion.div>
  );
}

// GlassTooltip - Glass tooltip
interface GlassTooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function GlassTooltip({ 
  content, 
  children, 
  position = 'top', 
  delay = 200 
}: GlassTooltipProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return true;
  });
  
  const [visible, setVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  
  const show = () => {
    const id = setTimeout(() => setVisible(true), delay);
    setTimeoutId(id);
  };
  
  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setVisible(false);
  };
  
  const positions = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' },
  };
  
  const glassStyles = getGlassStyles('strong', 3, isDark);
  
  return (
    <div 
      onMouseEnter={show} 
      onMouseLeave={hide} 
      onFocus={show} 
      onBlur={hide}
      style={{ display: 'inline-block', position: 'relative' }}
    >
      {children}
      <motion.div
              initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 10 : position === 'bottom' ? -10 : 0, x: position === 'left' ? 10 : position === 'right' ? -10 : 0 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15, ease: designTokens.animation.easings.easeOut as any }}
              style={{
                ...glassStyles,
                borderRadius: designTokens.borderRadius.md,
                padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
                fontSize: designTokens.typography.fontSizes.sm,
                color: isDark ? designTokens.colors.text.inverse : designTokens.colors.text.primary,
                whiteSpace: 'nowrap',
                position: 'absolute',
                zIndex: designTokens.zIndex.tooltip,
                pointerEvents: 'none',
                ...positions[position],
              }}
            >
              {content}
            </motion.div>
    </div>
  );
}

// Liquid glass background effect
export function LiquidGlassBackground({ 
  className = '', 
  style = {},
  animated = true 
}: { 
  className?: string; 
  style?: React.CSSProperties;
  animated?: boolean;
}) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return true;
  });
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        background: isDark 
          ? designTokens.colors.gradients.hero 
          : designTokens.colors.gradients.heroLight,
        overflow: 'hidden',
        ...style,
      }}
      aria-hidden="true"
    >
      {animated && (
        <>
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: `
              radial-gradient(ellipse at 30% 20%, rgba(25, 197, 209, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(117, 97, 238, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(55, 211, 174, 0.1) 0%, transparent 70%)
            `,
            animation: 'liquidFloat 25s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            top: '-30%',
            right: '-30%',
            width: '160%',
            height: '160%',
            background: `
              radial-gradient(ellipse at 40% 60%, rgba(117, 97, 238, 0.1) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 30%, rgba(25, 197, 209, 0.08) 0%, transparent 50%)
            `,
            animation: 'liquidFloat 30s ease-in-out infinite reverse',
          }} />
                  <style>{`
            @keyframes liquidFloat {
              0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
              25% { transform: translate(2%, -2%) rotate(1deg) scale(1.02); }
              50% { transform: translate(-1%, 3%) rotate(-1deg) scale(0.98); }
              75% { transform: translate(3%, 1%) rotate(0.5deg) scale(1.01); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

// Import hooks
import { useState, useEffect } from 'react';