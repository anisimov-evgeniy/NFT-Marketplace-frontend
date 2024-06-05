import React, { FormEvent, useState } from 'react';
import axios from 'axios';
import { notification } from 'antd';
import { Web3 } from 'web3';
import type { Contract, ContractAbi } from 'web3';

import { contractAbi, contractAddress } from './contractData/contractData';

import './App.css';

interface INft {
  creator: string;
  id: bigint;
  price: bigint;
  uri: string
}

const App: React.FC = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [contract, setContract] = useState<Contract<ContractAbi> | null>(null);
  const [nfts, setNfts] = useState<INft[]>([]);
  const [buffer, setBuffer] = useState<Uint8Array | null>(null);

  const mintNFT = async(price: string) => {
    if (!buffer || !contract || !account) {
      return;
    }

    try {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      formData.append('file', blob);

      const pinataOptions = JSON.stringify({ cidVersion: 0, });
      formData.append('pinataOptions', pinataOptions);

      const res = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        { maxContentLength: Infinity, headers: { Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}` }, }
      );

      const tokenURI = `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;

      contract.methods.mintNFT(tokenURI, Web3.utils.toWei(price, 'ether')).send({ from: account })
        .once('receipt', (receipt: unknown) => {
          if (receipt) {
            notification.success({ message: 'NFT minted successfully' });
            getAllNFTs(contract);
          }
        });
    } catch (error) {
      notification.error({ message: 'Error uploading file' });
      alert(error);
    }
  };

  const captureFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const file = event.target.files?.[0];
    const reader = new FileReader();

    if (file) {
      reader.readAsArrayBuffer(file);
    }

    reader.onloadend = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);

      setBuffer(uint8Array);
    };
  };

  async function buyNFT(id: bigint, price: bigint) {
    if (!contract || !account) {
      return;
    }

    try {
      await contract.methods.buyNFT(id).send({ from: account, value: web3?.utils.toWei(price, 'ether') })
        .once('receipt', (receipt: unknown) => {
          if (receipt) {
            notification.success({ message: 'NFT bought successfully' });
            getAllNFTs(contract);
          }
        });
    } catch (err) {
      notification.error({ message: 'Something wrong' });
      alert(err);
    }
  }

  async function getAllNFTs(currentContract: Contract<ContractAbi>) {
    const nfts: INft[] = await currentContract.methods.getAllNFTs().call();

    setNfts(nfts);
  }

  async function connectToMetamask() {
    if (window.ethereum) {
      try {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
        await window.ethereum.enable();

        const accounts = await web3Instance.eth.getAccounts();
        setAccount(accounts[0]);

        const contractInstance = new web3Instance.eth.Contract(contractAbi, contractAddress);
        setContract(contractInstance);

        await getAllNFTs(contractInstance);

        notification.success({ message: 'You are connected to Metamask' });
      } catch (err) {
        notification.error({ message: 'Something wrong' });
      }
    } else {
      notification.warning({ message: 'Please install MetaMask to use this dApp!' });
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const eventTarget = event.target as unknown as { description: { value: string }; price: { value: string } };
    const price = eventTarget.price.value;

    mintNFT(price);
  };

  // TODO: Customize styles
  return (
    <div className="mx-auto bg-emerald-900 pb-16">
      <div className="text-4xl align-middle font-semibold text-center pt-16 text-white">NFT Marketplace</div>
      {
        account
          ? (
              <div className="flex justify-center items-center flex-col pt-12 bg-emerald-900">
                <div className="text-center text-white border-double border-4 border-sky-500 w-1/2">Your Account: {account}</div>
                <form className="flex justify-center gap-14 pt-12" onSubmit={onSubmit}>
                  <input className="text-white" type="file" onChange={captureFile} />
                  <input name="price" placeholder="Price in ETH" type="text" />
                  <button className="text-white" type="submit">Mint NFT</button>
                </form>
                <div className="grid grid-cols-3 pt-12 gap-14 container mx-auto justify-items-center">
                  {
                    nfts.map((nft, key) => {

                      return (
                        <div className="border-2 rounded flex items-center flex-col gap-2 p-12 w-96 h-60" key={key}>
                          <img alt="" className="text-white" height="100px" src={nft.uri} width="100px" />
                          <div className="text-white">{web3?.utils.fromWei(nft.price, 'ether')} ETH</div>
                          <button className="text-white" onClick={() => buyNFT(nft.id, nft.price)}>Buy</button>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            )
          : (
              <div className="flex justify-center pt-16 text-white h-dvh bg-emerald-900">
                <button className="text-white" onClick={connectToMetamask}>connect to metamask</button>
              </div>
            )
      }
    </div>
  );
};

export default App;
