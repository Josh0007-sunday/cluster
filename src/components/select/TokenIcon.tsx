import { CoinGeckoLogo, ChainGeckoLogo, RowIcon } from './Logos';

export interface ModalRow {
  id: string;
  title: string;
  subtitle: string;
  chainId?: string;
  balance?: string | null;
  live?: boolean;
  loading?: boolean;
}

export { CoinGeckoLogo, ChainGeckoLogo, RowIcon };
