import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Marked } from './marked';

describe('Marked', () => {
  let component: Marked;
  let fixture: ComponentFixture<Marked>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Marked],
    }).compileComponents();

    fixture = TestBed.createComponent(Marked);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
