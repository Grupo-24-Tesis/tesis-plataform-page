import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Guards } from './guards';

describe('Guards', () => {
  let component: Guards;
  let fixture: ComponentFixture<Guards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Guards],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(Guards);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
