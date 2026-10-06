'use client';

import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  variant?: 'auto' | 'white' | 'black';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

const SIZE_CONFIGS = {
  sm: { class: 'h-7 w-auto' },
  md: { class: 'h-9 w-auto' },
  lg: { class: 'h-12 w-auto' },
  xl: { class: 'h-16 w-auto' },
};

export function BrandLogo({
  variant = 'auto',
  className = '',
  size = 'md',
  showSubtitle = false
}: BrandLogoProps) {
  const config = SIZE_CONFIGS[size];

  if (variant === 'white') {
    return (
      <div className={`flex flex-col items-start ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-itgames-dark.png"
          alt="ITGAMES Arena"
          className={`${config.class} object-contain`}
        />
        {showSubtitle && (
          <span className="text-[9px] text-zinc-400 font-medium tracking-tight mt-0.5">
            CrossFit & HYROX Platform
          </span>
        )}
      </div>
    );
  }

  if (variant === 'black') {
    return (
      <div className={`flex flex-col items-start ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-itgames-light.png"
          alt="ITGAMES Arena"
          className={`${config.class} object-contain`}
        />
        {showSubtitle && (
          <span className="text-[9px] text-zinc-600 font-medium tracking-tight mt-0.5">
            CrossFit & HYROX Platform
          </span>
        )}
      </div>
    );
  }

  // Modo 'auto': Exibe logo branca/brilhante no tema escuro e logo escura no tema claro / impressão
  return (
    <div className={`flex flex-col items-start ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-itgames-dark.png"
        alt="ITGAMES Arena"
        className={`${config.class} object-contain [html[data-theme='light']_&]:hidden [html:not([data-theme='light'])_&]:block print:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-itgames-light.png"
        alt="ITGAMES Arena"
        className={`${config.class} object-contain [html[data-theme='light']_&]:block [html:not([data-theme='light'])_&]:hidden print:block`}
      />
      {showSubtitle && (
        <span className="text-[9px] text-zinc-400 [html[data-theme='light']_&]:text-zinc-600 font-medium tracking-tight mt-0.5">
          CrossFit & HYROX Platform
        </span>
      )}
    </div>
  );
}
