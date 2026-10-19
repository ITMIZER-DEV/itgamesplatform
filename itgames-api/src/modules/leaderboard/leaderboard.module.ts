import { Global, Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { LeaderboardNotifier } from './leaderboard-notifier.service';
import { LeaderboardStreamService } from './leaderboard-stream.service';

@Global()
@Module({
  imports: [ScoringModule],
  providers: [LeaderboardNotifier, LeaderboardStreamService],
  exports: [LeaderboardNotifier],
})
export class LeaderboardModule {}
