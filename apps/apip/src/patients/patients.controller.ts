import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any) {
    const created = await this.patientsService.createPatient(body);
    return created;
  }

  @Get()
  async list(@Query('limit') limit = '20', @Query('offset') offset = '0') {
    const l = parseInt(limit as string, 10) || 20;
    const o = parseInt(offset as string, 10) || 0;
    return await this.patientsService.getPatients(l, o);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const patient = await this.patientsService.getPatientById(id);
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const updated = await this.patientsService.updatePatient(id, body);
    if (!updated) throw new NotFoundException('Patient not found');
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const deleted = await this.patientsService.deletePatient(id);
    if (!deleted) throw new NotFoundException('Patient not found');
    // return nothing (204) — client gets no content
    return;
  }
}
