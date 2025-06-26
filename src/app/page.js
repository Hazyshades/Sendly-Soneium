"use client";
import { Geist, Geist_Mono } from "next/font/google";
import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import axios from 'axios';
import Image from 'next/image';
import GiftCardABI from '../components/abis/GiftCard.json';
import amazonImg from '../components/assets/amazon.jpg';
import appleImg from '../components/assets/apple.jpg';
import airbnbImg from '../components/assets/airbnb.jpg';
import sendlyLogo from '../components/svg/sendly_logo.svg';
import soneiumLogo from '../components/svg/one-line-black.svg';
import giftBoxLogo from '../components/assets/download2.png';
import { useAccount } from 'wagmi';
import { SmartWalletConnect } from "../lib/SmartWalletConnect";
import ERC20ABI from '../components/abis/ERC20.json';
import { giftCard_Pink } from '../components/svg/giftCard_Pink.js';
import { giftCard_Blue } from '../components/svg/giftCard_Blue.js';
import { giftCard_Green } from '../components/svg/giftCard_Green';

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY;
const CONTRACT_ADDRESS = "0x5242f52732aabE5cB5Ab28fd24eAF28Ff41390B1";
const USDC_ADDRESS = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369";
const USDT_ADDRESS = "0x3a337a6ada9d885b6ad95ec48f9b75f197b5ae35";

// --- SVG and metadata on Pinata ---
async function uploadSVGAndMetadataToPinata({ amount, serviceName, generator }, setNotification) {
  try {
    setNotification({ show: true, message: "Uploading SVG to Pinata...", type: 'success' });

    // 1. SVG -> IPFS
    const svgString = generator(amount, serviceName);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const svgForm = new FormData();
    svgForm.append('file', svgBlob, 'image.svg');

    const svgRes = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', svgForm, {
      maxContentLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${svgForm._boundary || 'boundary'}`,
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_API_KEY
      },
    });

    const svgHash = svgRes.data.IpfsHash;
    const svgUrl = `https://gateway.pinata.cloud/ipfs/${svgHash}`;

    // 2. Metadata -> IPFS
    setNotification({ show: true, message: "Uploading metadata to Pinata...", type: 'success' });

    const metadataObj = {
      name: `Gift Card $${amount}`,
      description: `Gift card for $${amount}`,
      image: svgUrl,
      attributes: [
        { trait_type: "Amount", value: amount },
        { trait_type: "Service", value: serviceName }
      ]
    };

    const metadataRes = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      metadataObj,
      {
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_API_KEY,
        },
      }
    );

    const metadataHash = metadataRes.data.IpfsHash;
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataHash}`;

    return metadataUrl;
  } catch (e) {
    setNotification({ show: true, message: "Error uploading to Pinata: " + e.message, type: 'error' });
    throw e;
  }
}

function Page() {
  const [activeTab, setActiveTab] = useState('create');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenType, setTokenType] = useState('USDC');
  const [message, setMessage] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [giftCards, setGiftCards] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [web3, setWeb3] = useState(null);
  const { address, isConnected } = useAccount();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalKey, setWalletModalKey] = useState(0);
  const [infoSection, setInfoSection] = useState(null);

  const handleServiceClick = (serviceName) => {
    if (selectedService === serviceName) {
      setSelectedService(null); // remove choice
    } else {
      setSelectedService(serviceName); // choose service
    }
  };

  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSpinning(true), 1200); // same as in animation app.css
    return () => clearTimeout(timer);
  }, []);

  // Card designs and selected design
  const cardDesigns = [
    { name: "Pink", generator: giftCard_Pink },
    { name: "Blue", generator: giftCard_Blue },
    { name: "Green", generator: giftCard_Green },
  ];
  const [selectedDesign, setSelectedDesign] = useState(cardDesigns[0]);

  const openWalletModal = () => {
    setWalletModalKey(prev => prev + 1);
    setWalletModalOpen(true);
  };
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (isConnected && address) {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      const contractInstance = new web3Instance.eth.Contract(GiftCardABI, CONTRACT_ADDRESS);
      setContract(contractInstance);
      setAccount(address);
      loadGiftCards(contractInstance, address, web3Instance);
    }
  }, [isConnected, address]);

  // Load gift cards only when the active tab is 'mycards'  
  useEffect(() => {
    if (
      activeTab === 'mycards' &&
      contract &&
      account &&
      web3
    ) {
      loadGiftCards(contract, account, web3);
    }
  }, [activeTab, contract, account, web3]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => setNotification({ ...notification, show: false }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const services = [
    { name: 'Amazon', img: amazonImg.src },
    { name: 'Apple', img: appleImg.src },
    { name: 'Airbnb', img: airbnbImg.src },
  ];

  const loadGiftCards = async (contractInstance, userAccount, web3Instance) => {
    
    if (!contractInstance || !userAccount || !web3Instance) return;
    try {
      const balance = await contractInstance.methods.balanceOf(userAccount).call();
      const cards = [];
      for (let i = 0; i < balance; i++) {
        try {
          const tokenId = await contractInstance.methods.tokenOfOwnerByIndex(userAccount, i).call();
          const giftCardInfo = await contractInstance.methods.getGiftCardInfo(tokenId).call();
          const metadataURI = await contractInstance.methods.tokenURI(tokenId).call();
          let image = '';
          if (metadataURI) {
            try {
              const meta = await fetch(metadataURI);
              const metaJson = await meta.json();
              image = metaJson.image;
            } catch (e) {
              image = '';
            }
          }
          const amount = web3Instance.utils.fromWei(giftCardInfo.amount.toString(), 'mwei');
          const token = giftCardInfo.token === USDC_ADDRESS ? 'USDC' : 'USDT';
          const card = {
            tokenId: tokenId.toString(),
            recipient: userAccount,
            sender: 'Unknown',
            amount,
            token,
            message: giftCardInfo.message,
            metadataURI: metadataURI || '',
            redeemed: giftCardInfo.redeemed,
            image
          };
          if (!giftCardInfo.redeemed) {
            cards.push(card);
          }
        } catch (error) {
          continue;
        }
      }
      setGiftCards(cards);
    } catch (error) {
      setGiftCards([]);
    }
  };

  const handleCardClick = (id) => {
    setActiveTab('spend');
    setTokenId(id);
  };

  const createGiftCard = async () => {
    if (!contract || !web3) {
      setNotification({ show: true, message: "Contract or Web3 not initialized.", type: 'error' });
      return;
    }
    try {
      const tokenAddress = tokenType === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;
      const amountInWei = web3.utils.toWei(amount, 'mwei');

      // 1. Check allowance
      const tokenContract = new web3.eth.Contract(ERC20ABI, tokenAddress);
      const allowance = await tokenContract.methods.allowance(account, CONTRACT_ADDRESS).call();

      if (BigInt(allowance) < BigInt(amountInWei)) {
        setNotification({ show: true, message: "Making approve...", type: 'success' });
        await tokenContract.methods
          .approve(CONTRACT_ADDRESS, amountInWei)
          .send({ from: account });
        setNotification({ show: true, message: "Approve success!", type: 'success' });
      }
      // 2. Upload SVG and metadata to Pinata
      const metadataURI = await uploadSVGAndMetadataToPinata(
        { amount, serviceName: selectedService?.name || "Gift Card", generator: selectedDesign.generator },
        setNotification
      );

      // 3. Prepare transaction data
      const createGiftCardTx = contract.methods.createGiftCard(
        recipient,
        amountInWei,
        tokenAddress,
        metadataURI,
        message
      );

      let tx;
      try {
        tx = await createGiftCardTx.send({ from: account });
      } catch (error) {
        setNotification({ show: true, message: "Failed to create gift card: " + error.message, type: 'error' });
        return;
      }

      const tokenId = tx.events.GiftCardCreated.returnValues.tokenId;
      const newCard = {
        tokenId,
        recipient,
        amount,
        token: tokenType,
        metadataURI,
        message,
        redeemed: false
      };

      setGiftCards([...giftCards, newCard]);
      setNotification({
        show: true,
        message: `Gift card created successfully!<br/>Card ID: <span class="break-all">${tokenId}</span>`,
        type: 'success'
      });

    } catch (error) {
      setNotification({ show: true, message: "Failed to create gift card: " + error.message, type: 'error' });
    }
  };

  const redeemGiftCard = async (mode) => {
    if (!contract || !web3) {
      setNotification({ show: true, message: "Contract or Web3 not initialized.", type: 'error' });
      return;
    }
    try {
      const tokenIdBigInt = typeof BigInt !== "undefined" ? BigInt(tokenId) : parseInt(tokenId, 10);
      const gasEstimate = await contract.methods.redeemGiftCard(tokenIdBigInt).estimateGas({ from: account });
      const gasPrice = await web3.eth.getGasPrice();
      const gasLimit = Math.floor(Number(gasEstimate) * 1.1);
      const tx = await contract.methods.redeemGiftCard(tokenIdBigInt).send({
        from: account,
        gas: gasLimit,
        gasPrice: gasPrice
      });
  
      if (mode === 'service') {
        setNotification({
          show: true,
          message: `Card successfully redeemed in service!<br/>Hash: <span class="break-all">${tx.transactionHash}</span>`,
          type: 'success'
        });
      } else {
        setNotification({
          show: true,
          message: `Funds received to your wallet!<br/>Hash: <span class="break-all">${tx.transactionHash}</span>`,
          type: 'success'
        });
      }
  
      setTokenId('');
      await loadGiftCards(contract, account, web3);
    } catch (error) {
      setNotification({ show: true, message: "Failed to redeem card: " + error.message, type: 'error' });
    }
  };

  const serviceRedirects = {
    Amazon: "https://www.amazon.com/gift-cards/",
    Apple: "https://www.apple.com/uk/shop/gift-cards",
    Airbnb: "https://www.airbnb.com/giftcards"
  };

  useEffect(() => {
    if (isConnected && walletModalOpen) {
      setWalletModalOpen(false);
    }
  }, [isConnected, walletModalOpen]);

  useEffect(() => {
    if (
      notification.show &&
      notification.type === 'success' &&
      notification.message.includes('Card successfully redeemed in service') &&
      selectedService &&
      serviceRedirects[selectedService]
    ) {
      const timer = setTimeout(() => {
        window.location.href = serviceRedirects[selectedService];
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [notification, selectedService]);

  const handleInfoClick = (section) => {
    setInfoSection(prev => prev === section ? null : section);
  };

  return (
    
    <div className="min-h-screen w-full bg-radial-gradient font-sans">
      {notification.show && (
        <div className="fixed top-6 right-6 z-50">
          <div className={`bg-white rounded-xl shadow-lg px-6 py-4 border-2
      ${notification.type === 'success' ? 'border-green-400' : 'border-red-400'}`}>
            <div className="text-lg font-bold text-indigo-700">
              {notification.type === 'success' ? 'Success!' : 'Error'}
            </div>
            <div
              className="text-base text-gray-700 mb-2"
              dangerouslySetInnerHTML={{ __html: notification.message }}
            />
            <button
              className="mt-1 px-4 py-1 bg-indigo-500 text-white rounded font-semibold hover:bg-indigo-600 transition"
              onClick={() => setNotification({ ...notification, show: false })}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <SmartWalletConnect
        key={walletModalKey}
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      <header className="flex items-center justify-between bg-white/80 backdrop-blur-sm shadow-lg px-4 py-4 mb-8 rounded-b-3xl relative">

        <div className="flex items-center">
          <Image
            src={giftBoxLogo}
            alt="giftBoxLogo"
            width={170}
            height={170}
            className={`block ${spinning ? 'flip-vertical' : ''}`}
            style={{ maxWidth: 170, maxHeight: 170 }}
          />
        </div>


        <div className="flex flex-col items-center flex-1">
          <div className="flex justify-center gap-4 mb-2">
            <button onClick={() => handleInfoClick('how')} className={`px-4 py-2 rounded-lg font-semibold text-base transition ${infoSection==='how' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>How Sendly Works</button>
            <button onClick={() => handleInfoClick('features')} className={`px-4 py-2 rounded-lg font-semibold text-base transition ${infoSection==='features' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>Features</button>
            <button onClick={() => handleInfoClick('merchants')} className={`px-4 py-2 rounded-lg font-semibold text-base transition ${infoSection==='merchants' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>For Merchants</button>
            <button onClick={() => handleInfoClick('faq')} className={`px-4 py-2 rounded-lg font-semibold text-base transition ${infoSection==='faq' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>FAQ</button>
          </div>
          <div className="flex flex-col items-center relative">
            <Image
              src={sendlyLogo}
              alt="Sendly Logo"
              width={400}
              height={400}
              className="block rounded-lg border-none"
              style={{ maxWidth: 1200, maxHeight: 1200 }}
            />
            <Image
              src={soneiumLogo}
              alt="Soneium Logo"
              width={200}
              height={200}
              className="block rounded-lg border-none"
              style={{ maxWidth: 200, maxHeight: 200 }}
            />
          </div>
        </div>

        {/* Правая часть: Connect wallet и адрес */}
        <div className="flex items-center gap-2">
          {!isConnected && (
            <button onClick={openWalletModal}
              className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold text-lg shadow hover:bg-indigo-600 transition"
            >
              Connect wallet
            </button>
          )}
          {isConnected && address && (
            <div className="flex items-center gap-2 mt-2">
              <div className="text-sm font-medium text-indigo-700">
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ВЫПАДАЮЩИЙ БЛОК С ИНФО-СЕКЦИЯМИ */}
      {infoSection === 'how' && (
        <section className="py-16 bg-white border-b-2 border-indigo-100 animate-fade-in">
          <div className="w-full px-2 sm:px-8 lg:px-24 xl:px-40 2xl:px-64 mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">How Sendly Works</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Four simple steps to create and send personalized NFT gift cards
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              {[
                ["✨", "Create Your Card", "Design a personalized NFT gift card with custom messages and artwork"],
                ["💰", "Add Value", "Load your card with USDC or USDT - any amount you choose"],
                ["🚀", "Send Instantly", "Send via wallet address, email, or shareable link anywhere in the world"],
                ["🎁", "Easy Redemption", "Recipients redeem to their smart wallet or spend on integrated platforms"]
              ].map(([icon, title, desc], i) => (
                <div key={i} className="text-center bg-white rounded-2xl shadow-lg p-8 h-full flex flex-col items-center justify-start">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                    {i + 1}
                  </div>
                  <div className="text-4xl mb-4">{icon}</div>
                  <h3 className="text-xl font-semibold mb-4">{title}</h3>
                  <p className="text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {infoSection === 'features' && (
        <section className="py-16 bg-gradient-to-br from-blue-50 to-purple-50 border-b-2 border-indigo-100 animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose Sendly?</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Discover the features that make Sendly the future of digital gifting
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                {[
                  ["🌉", "Web2-Web3 Bridge", "Seamlessly redeemable on traditional platforms and decentralized ecosystems"],
                  ["⚡", "Soneium Network Powered", "Ultra-fast, secure transactions with entertainment-grade infrastructure"],
                  ["🧠", "Smart Wallet Integration", "No complex wallet setups - just user-friendly redemption"]
                ].map(([icon, title, desc], i) => (
                  <div key={i} className="flex items-start space-x-4">
                    <div className="text-3xl">{icon}</div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{title}</h3>
                      <p className="text-gray-600">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-xl">
                <h3 className="text-2xl font-bold mb-6">Coming Soon: Platform Integrations</h3>
                <div className="space-y-4">
                  {[
                    ["PlayStation Store", "In Development", "bg-blue-100 text-blue-800"],
                    ["Sony Music", "Planned", "bg-purple-100 text-purple-800"],
                    ["Sony Pictures", "Planned", "bg-red-100 text-red-800"],
                    ["Amazon", "Planned", "bg-orange-100 text-orange-800"],
                    ["Steam", "Exploring", "bg-gray-100 text-gray-800"]
                  ].map(([name, status, color], i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{name}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      {infoSection === 'merchants' && (
        <section className="py-16 bg-white border-b-2 border-indigo-100 animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Partner With Sendly</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Join our growing ecosystem and tap into the future of digital commerce
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-6">Benefits for Merchants</h3>
                <ul className="space-y-4">
                  {[
                    "Access to crypto-native customers",
                    "Reduced payment processing fees",
                    "Instant settlement with stablecoins",
                    "Global reach without currency conversion",
                    "Web3 marketing opportunities",
                    "Future-proof payment infrastructure"
                  ].map((benefit, i) => (
                    <li key={i} className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <button className="mt-8 bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
                  Become a Partner
                </button>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-8 rounded-2xl">
                <h4 className="text-xl font-bold mb-4">Integration Process</h4>
                <div className="space-y-4">
                  {[
                    [1, "API Integration", "Simple REST API for gift card redemption"],
                    [2, "Testing Phase", "Sandbox environment for thorough testing"],
                    [3, "Go Live", "Launch with full marketing support"]
                  ].map(([step, title, desc], i) => (
                    <div key={i} className="flex items-start space-x-4">
                      <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{step}</div>
                      <div>
                        <h5 className="font-semibold">{title}</h5>
                        <p className="text-gray-600 text-sm">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      {infoSection === 'faq' && (
        <section className="py-16 bg-gray-50 border-b-2 border-indigo-100 animate-fade-in">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
              <p className="text-xl text-gray-600">Everything you need to know about Sendly</p>
            </div>
            <div className="space-y-4">
              {[
                ["What is an NFT gift card?", "A unique digital token loaded with USDC or USDT, customizable and transferable."],
                ["How do I redeem a gift card?", "Connect your wallet, select a card, and redeem it on-chain or to your balance."],
                ["Is Sendly secure?", "Yes, it's built on the Soneium network for entertainment-grade security."],
                ["Can I use traditional platforms?", "Yes! We're working on integrations with platforms like Amazon, Sony, and more."]
              ].map(([q, a], i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm">
                  <details className="group">
                    <summary className="cursor-pointer p-6 text-lg font-semibold text-gray-900 group-open:rounded-b-none">
                      {q}
                    </summary>
                    <div className="px-6 pb-6 text-gray-600">{a}</div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-xl mx-auto bg-white/90 rounded-3xl shadow-2xl p-8">
        <div className="flex justify-center mb-8">
          <button
            className={`px-6 py-3 rounded-t-2xl font-bold text-lg transition ${activeTab === 'create'
              ? 'bg-indigo-500 text-white shadow'
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              }`}
            onClick={() => setActiveTab('create')}
          >
            Create a gift card
          </button>
          <button
            className={`px-6 py-3 rounded-t-2xl font-bold text-lg transition ml-2 ${activeTab === 'mycards'
              ? 'bg-indigo-500 text-white shadow'
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              }`}
            onClick={() => setActiveTab('mycards')}
          >
            My cards
          </button>
          <button
            className={`px-6 py-3 rounded-t-2xl font-bold text-lg transition ml-2 ${activeTab === 'spend'
              ? 'bg-indigo-500 text-white shadow'
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              }`}
            onClick={() => setActiveTab('spend')}
          >
            Spend a card
          </button>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-inner min-h-[300px]">
          {activeTab === 'create' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-indigo-700">Create a gift card</h2>
              <input
                type="text"
                placeholder="Recipient address (0x...)"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
              />
              <input
                type="number"
                placeholder="Amount (for example, 10)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
              />
              <div className="mb-4">
                <label className="block font-semibold mb-2 text-indigo-700">Card design:</label>
                <div className="flex gap-4">
                  {cardDesigns.map((design) => (
                    <button
                      key={design.name}
                      type="button"
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition
                        ${selectedDesign.name === design.name
                          ? 'border-indigo-500 bg-indigo-100'
                          : 'border-gray-200 bg-white hover:border-indigo-300'}`}
                      onClick={() => setSelectedDesign(design)}
                    >
                      {design.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-8 items-center mb-3">
                <label className="font-medium flex items-center">
                  <input
                    type="radio"
                    value="USDC"
                    checked={tokenType === 'USDC'}
                    onChange={() => setTokenType('USDC')}
                    className="mr-2 accent-indigo-500"
                  />
                  USDC
                </label>
                <label className="font-medium flex items-center">
                  <input
                    type="radio"
                    value="USDT"
                    checked={tokenType === 'USDT'}
                    onChange={() => setTokenType('USDT')}
                    className="mr-2 accent-indigo-500"
                  />
                  USDT
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "32px 0" }}>
                <h3 className="text-lg font-semibold mb-2">Preview of gift card</h3>
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(
                    selectedDesign.generator(amount || 0, selectedService?.name || "Gift Card")
                  )}`}
                  alt="Gift Card Preview"
                  style={{ width: 350, height: 220, borderRadius: 24, boxShadow: "0 8px 32px rgba(80,40,120,0.18)" }}
                />
              </div>
              <input
                type="text"
                placeholder="Message (for example, Happy Birthday!)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
              />
              <button
                onClick={createGiftCard}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-400 text-white rounded-xl font-bold text-lg mt-2 shadow hover:from-indigo-600 hover:to-indigo-500 transition"
              >
                Create a card
              </button>
            </div>
          )}
          {activeTab === 'mycards' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-indigo-700">My cards</h2>
              {giftCards.length > 0 ? (
                <ul className="flex flex-col items-center space-y-8">
                  {giftCards.map(card => (
                    <li
                      key={card.tokenId}
                      className="p-6 bg-white rounded-3xl shadow-xl flex flex-col items-center"
                      style={{ minWidth: 340, maxWidth: 360 }}
                    >
                      {card.image && (
                        <img
                          src={card.image}
                          alt="Gift Card"
                          style={{
                            width: 320,
                            height: 200,
                            borderRadius: 24,
                            objectFit: 'cover',
                            boxShadow: '0 8px 32px rgba(80,40,120,0.18)',
                            marginBottom: 16,
                            border: '3px solid #a18cd1',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleCardClick(card.tokenId)}
                          title="Spend this card"
                        />
                      )}
                      <div className="font-bold text-indigo-600 text-lg mb-2">Card ID: {card.tokenId}</div>
                      {card.message && (
                        <div className="italic text-indigo-900 text-base text-center mb-1">
                          &quot;{card.message}&quot;
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-center">You don&apos;t have any gift cards yet</p>
              )}
            </div>
          )}
          {activeTab === 'spend' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-indigo-700">Spend a Card on Services</h2>
              <div className="flex justify-center gap-6 mb-6">
                {services.map(service => (
                  <button
                    key={service.name}
                    onClick={() => handleServiceClick(service.name)}
                    className={`rounded-2xl shadow-lg overflow-hidden border-4 transition-all duration-200
                      ${selectedService === service.name ? 'border-indigo-500 scale-105' : 'border-transparent hover:scale-105 hover:border-indigo-300'}`}
                    style={{ width: 120, height: 120, opacity: selectedService && selectedService !== service.name ? 0.5 : 1 }}
                  >
                    <img src={service.img} alt={service.name} className="object-cover w-full h-full" />
                  </button>
                ))}
              </div>
              {selectedService && (
                <div className="mb-4 text-center text-lg font-semibold text-indigo-700">
                  You selected: {selectedService}
                </div>
              )}
              <input
                type="number"
                placeholder="Card ID"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
              />
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => redeemGiftCard('service')}
                  className={`w-full py-3 rounded-xl font-bold text-lg shadow transition
                    ${selectedService
                      ? 'bg-gradient-to-r from-indigo-500 to-indigo-400 text-white hover:from-indigo-600 hover:to-indigo-500'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  disabled={!selectedService}
                >
                  Spend in Service
                </button>
                <button
                  onClick={() => redeemGiftCard('wallet')}
                  className={`w-full py-3 rounded-xl font-bold text-lg shadow transition
                    ${!selectedService
                      ? 'bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-600 hover:to-green-500'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  disabled={!!selectedService}
                >
                  Receive to Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Page;