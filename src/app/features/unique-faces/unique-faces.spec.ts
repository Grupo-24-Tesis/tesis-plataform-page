import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UniqueFaces } from './unique-faces';

describe('UniqueFaces', () => {
  let component: UniqueFaces;
  let fixture: ComponentFixture<UniqueFaces>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UniqueFaces],
    }).compileComponents();

    fixture = TestBed.createComponent(UniqueFaces);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
