import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { GetCallHistoryUseCase } from '../application/use-cases/get-call-history.use-case';
import { GetCallDetailUseCase } from '../application/use-cases/get-call-detail.use-case';

/**
 * Presentation Layer: Reports Controller
 * Handles PDF export and call history endpoints
 */
@Controller('api/reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly getCallHistoryUseCase: GetCallHistoryUseCase,
    private readonly getCallDetailUseCase: GetCallDetailUseCase,
  ) {}

  /**
   * GET /api/reports/calls
   * Retrieve call history with pagination, search and filters
   */
  @Get('calls')
  async getCallHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('priority') priority?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    try {
      const result = await this.getCallHistoryUseCase.execute({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        search: search || undefined,
        priority: priority || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(`❌ Error in getCallHistory: ${(error as Error).message}`);
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * GET /api/reports/calls/:id/pdf-data
   * Get detailed call data for PDF generation (frontend-side jsPDF)
   */
  @Get('calls/:id/pdf-data')
  async getCallPdfData(@Param('id') callId: string) {
    try {
      const data = await this.getCallDetailUseCase.execute(callId);

      if (!data) {
        return {
          success: false,
          message: 'Appel non trouvé',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error(`❌ Error in getCallPdfData: ${(error as Error).message}`);
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }
}
