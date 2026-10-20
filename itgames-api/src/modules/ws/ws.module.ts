import { Global, Module } from '@nestjs/common';
import { WsUpgradeRouter } from './ws-upgrade-router';

@Global()
@Module({ providers: [WsUpgradeRouter], exports: [WsUpgradeRouter] })
export class WsModule {}
