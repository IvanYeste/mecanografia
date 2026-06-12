import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextTarget } from './text-target';

describe('TextTarget', () => {
  let component: TextTarget;
  let fixture: ComponentFixture<TextTarget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextTarget]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextTarget);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
