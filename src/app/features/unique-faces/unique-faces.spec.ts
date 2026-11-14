import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UniqueFaces } from './unique-faces';

describe('UniqueFaces', () => {
  let component: UniqueFaces;
  let fixture: ComponentFixture<UniqueFaces>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UniqueFaces],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(UniqueFaces);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
