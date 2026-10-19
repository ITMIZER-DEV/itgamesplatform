import { Global, Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LeaderboardNotifier } from './leaderboard-notifier.service';
import { LeaderboardStreamService } from './leaderboard-stream.service';

@Global()
@Module({
  imports: [EventsModule],
  providers: [LeaderboardNotifier, LeaderboardStreamService],
  exports: [LeaderboardNotifier],
})
export class LeaderboardModule {}
