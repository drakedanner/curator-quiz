import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [mainnet],
    transports: {
      [mainnet.id]: http(),
    },
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
    appName: "Curator Quiz",
    appDescription: "DeFi collateral knowledge quiz",
  })
);
