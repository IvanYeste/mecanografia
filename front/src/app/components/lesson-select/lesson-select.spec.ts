import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonSelect } from './lesson-select';

describe('LessonSelect', () => {
  let component: LessonSelect;
  let fixture: ComponentFixture<LessonSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonSelect]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LessonSelect);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
