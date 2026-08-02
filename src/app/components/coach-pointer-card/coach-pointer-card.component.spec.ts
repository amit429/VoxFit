import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CoachPointerCardComponent } from './coach-pointer-card.component';

describe('CoachPointerCardComponent', () => {
  let fixture: ComponentFixture<CoachPointerCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoachPointerCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(CoachPointerCardComponent);
    fixture.componentRef.setInput('title', 'New check-in ready');
    fixture.componentRef.setInput('subtitle', 'Your weekly progress reflection');
    fixture.componentRef.setInput('link', '/tabs/profile');
  });

  it('renders title and subtitle', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('New check-in ready');
    expect(text).toContain('Your weekly progress reflection');
  });

  it('points its anchor at the provided link', () => {
    fixture.detectChanges();
    const anchor = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/tabs/profile');
  });

  it('carries no red / danger styling (calm register)', () => {
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toMatch(/danger|text-red|bg-red|border-red/);
  });
});
