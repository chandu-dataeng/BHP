import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * If a photo URL fails to load, swap in a local illustration so cards never look broken.
 * Usage: <img [src]="url" appImgFallback="land">
 */
@Directive({ selector: 'img[appImgFallback]' })
export class ImgFallbackDirective {
  readonly appImgFallback = input<'building' | 'interior' | 'land' | ''>('building');
  private el = inject(ElementRef<HTMLImageElement>);
  private applied = false;

  @HostListener('error')
  onError() {
    if (this.applied) return;
    this.applied = true;
    this.el.nativeElement.src = `images/fallback-${this.appImgFallback() || 'building'}.svg`;
  }
}
