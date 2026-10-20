import { Controller, Get, Param } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  list() {
    return this.quizzes.listPublished();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.quizzes.getPublished(id);
  }
}
