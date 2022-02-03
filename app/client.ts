import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { TestCoin } from '../target/types/test_coin';

export class TestCoinClient {
  private readonly program: Program<TestCoin>;

  constructor(){
    anchor.setProvider(anchor.Provider.env());
    this.program = anchor.workspace.TestCoin as Program<TestCoin>;
  }

  totalSupply = async (): Promise<number> => {
    const response = await this.program.simulate.totalSupply({})
    return this.getReturnValue(response.events)
  }

  private getReturnValue = <T>(simulatedEvents: ReadonlyArray<anchor.Event>): T => {
    const data = simulatedEvents.find(x => x.name == "ReturnEvent").data as any as ReturnData<T>
    return data.value;
  }
}

export interface ReturnData<T> {
  value: T
}
