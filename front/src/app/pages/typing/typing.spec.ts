import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Typing } from './typing';

describe('Typing', () => {
  let component: Typing;
  let fixture: ComponentFixture<Typing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Typing]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Typing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
