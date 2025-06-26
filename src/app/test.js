import React, { useState, useEffect } from 'react';

// Конфигурация сети Soneium
const SONEIUM_CONFIG = {
  chainId: '0x7E6', // 2022 в hex - Soneium Mainnet
  chainName: 'Soneium Mainnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.soneium.org'],
  blockExplorerUrls: ['https://explorer.soneium.org'],
};

// Smart Contract конфигурация
const CONTRACT_CONFIG = {
  address: '0x...', // Адрес вашего контракта на Soneium
  abi: [
    // Базовый ABI для NFT gift cards
    {
      "inputs": [
        {"name": "_recipient", "type": "address"},
        {"name": "_amount", "type": "uint256"},
        {"name": "_message", "type": "string"}
      ],
      "name": "createGiftCard",
      "outputs": [{"name": "", "type": "uint256"}],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [{"name": "_tokenId", "type": "uint256"}],
      "name": "redeemGiftCard",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{"name": "_tokenId", "type": "uint256"}],
      "name": "getGiftCard",
      "outputs": [
        {"name": "amount", "type": "uint256"},
        {"name": "message", "type": "string"},
        {"name": "redeemed", "type": "bool"}
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
};

const SendlyWebsite = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [ethersLoaded, setEthersLoaded] = useState(false);
  const [showWalletInstall, setShowWalletInstall] = useState(false);

  // Проверка доступности Web3
  const checkWeb3 = () => {
    console.log('Checking Web3 availability...');
    console.log('Current window object:', typeof window);
    console.log('window.ethereum:', typeof window?.ethereum);
    console.log('window.web3:', typeof window?.web3);
    
    // Проверяем различные провайдеры
    const providers = {
      ethereum: typeof window !== 'undefined' && typeof window.ethereum !== 'undefined',
      web3: typeof window !== 'undefined' && typeof window.web3 !== 'undefined',
      // Проверяем другие популярные кошельки
      coinbaseWallet: typeof window !== 'undefined' && (window.ethereum?.isCoinbaseWallet || window.coinbaseWalletExtension),
      trustWallet: typeof window !== 'undefined' && window.ethereum?.isTrust,
      braveWallet: typeof window !== 'undefined' && window.ethereum?.isBraveWallet,
    };
    
    console.log('Available providers:', providers);
    
    const hasEthereum = providers.ethereum;
    const hasWeb3 = providers.web3;
    
    console.log('Has Ethereum:', hasEthereum);
    console.log('Has Web3:', hasWeb3);
    
    // Проверяем специфические свойства MetaMask
    if (hasEthereum && window.ethereum) {
      console.log('Ethereum provider details:', {
        isMetaMask: window.ethereum.isMetaMask,
        selectedAddress: window.ethereum.selectedAddress,
        chainId: window.ethereum.chainId,
        isCoinbaseWallet: window.ethereum.isCoinbaseWallet,
        isTrust: window.ethereum.isTrust,
        isBraveWallet: window.ethereum.isBraveWallet
      });
    }
    
    return hasEthereum || hasWeb3;
  };

  // Добавление сети Soneium в MetaMask
  const addSoneiumNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [SONEIUM_CONFIG],
      });
    } catch (error) {
      console.error('Failed to add Soneium network:', error);
      throw error;
    }
  };

  // Переключение на сеть Soneium
  const switchToSoneium = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SONEIUM_CONFIG.chainId }],
      });
    } catch (switchError) {
      // Если сеть не добавлена, добавляем её
      if (switchError.code === 4902) {
        await addSoneiumNetwork();
      } else {
        throw switchError;
      }
    }
  };

  // Инициализация контракта
  const initContract = async (provider) => {
    try {
      if (!window.ethers) {
        throw new Error('Ethers.js not loaded');
      }
      
      const signer = provider.getSigner();
      const contractInstance = new window.ethers.Contract(
        CONTRACT_CONFIG.address,
        CONTRACT_CONFIG.abi,
        signer
      );
      setContract(contractInstance);
      return contractInstance;
    } catch (error) {
      console.error('Failed to initialize contract:', error);
      throw error;
    }
  };

  // Подключение кошелька
  const connectWallet = async () => {
    console.log('Starting wallet connection...');
    setIsLoading(true);
    setError('');
    
    try {
      // Проверяем наличие Web3
      if (!checkWeb3()) {
        console.error('No Web3 wallet detected');
        setShowWalletInstall(true);
        setError('No Web3 wallet detected. Please install a wallet to continue.');
        return;
      }

      // Дополнительная проверка ethers.js
      if (!ethersLoaded || !window.ethers) {
        const errorMsg = 'Web3 libraries still loading. Please wait a moment and try again.';
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }

      console.log('Web3 detected, requesting accounts...');
      
      // Запрос подключения аккаунта
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      console.log('Accounts received:', accounts);

      if (accounts.length === 0) {
        setError('No accounts found. Please unlock your wallet.');
        return;
      }

      // Создаем провайдер
      console.log('Creating provider...');
      if (!window.ethers) {
        throw new Error('Ethers.js not loaded. Please wait for the library to load.');
      }
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      
      // Получаем текущую сеть
      const network = await provider.getNetwork();
      console.log('Current network:', network);
      
      // Переключаемся на сеть Soneium (только если нужно)
      if (network.chainId !== parseInt(SONEIUM_CONFIG.chainId, 16)) {
        console.log('Switching to Soneium network...');
        await switchToSoneium();
      }
      
      // Инициализируем контракт (только если адрес указан)
      if (CONTRACT_CONFIG.address !== '0x...') {
        console.log('Initializing contract...');
        await initContract(provider);
      } else {
        console.log('Contract address not set, skipping contract initialization');
      }

      setWalletConnected(true);
      setWalletAddress(accounts[0]);
      console.log('Wallet connected successfully:', accounts[0]);
      
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setError(`Failed to connect wallet: ${error.message || error.toString()}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Создание NFT gift card
  const createGiftCard = async (recipient, amount, message) => {
    if (!contract) {
      setError('Contract not initialized');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Конвертируем amount в wei (для USDC используем 6 decimals)
      const amountInWei = window.ethers.utils.parseUnits(amount.toString(), 6);
      
      // Отправляем транзакцию
      const tx = await contract.createGiftCard(
        recipient || walletAddress, // Если recipient не указан, отправляем себе
        amountInWei,
        message,
        {
          value: window.ethers.utils.parseEther('0.01') // Комиссия за создание (0.01 ETH)
        }
      );

      // Ждем подтверждения
      const receipt = await tx.wait();
      
      // Получаем tokenId из события
      const event = receipt.events.find(e => e.event === 'GiftCardCreated');
      const tokenId = event ? event.args.tokenId.toString() : null;

      return { success: true, tokenId, txHash: receipt.transactionHash };
      
    } catch (error) {
      console.error('Failed to create gift card:', error);
      setError(`Failed to create gift card: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Погашение NFT gift card
  const redeemGiftCard = async (tokenId) => {
    if (!contract) {
      setError('Contract not initialized');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const tx = await contract.redeemGiftCard(tokenId);
      const receipt = await tx.wait();
      
      return { success: true, txHash: receipt.transactionHash };
      
    } catch (error) {
      console.error('Failed to redeem gift card:', error);
      setError(`Failed to redeem gift card: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Получение информации о gift card
  const getGiftCardInfo = async (tokenId) => {
    if (!contract) return null;

    try {
      const [amount, message, redeemed] = await contract.getGiftCard(tokenId);
      return {
        amount: window.ethers.utils.formatUnits(amount, 6), // USDC has 6 decimals
        message,
        redeemed
      };
    } catch (error) {
      console.error('Failed to get gift card info:', error);
      return null;
    }
  };

  // Загружаем ethers.js и проверяем подключение кошелька
  useEffect(() => {
    const loadEthers = () => {
      if (window.ethers) {
        console.log('Ethers.js already loaded');
        setEthersLoaded(true);
        return;
      }

      console.log('Loading ethers.js...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js';
      script.async = true;
      script.onload = () => {
        console.log('Ethers.js loaded successfully');
        setEthersLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load ethers.js');
      };
      document.head.appendChild(script);
    };

    const checkConnection = async () => {
      if (checkWeb3() && window.ethereum && window.ethereum.selectedAddress && window.ethers) {
        try {
          const provider = new window.ethers.providers.Web3Provider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setWalletConnected(true);
            setWalletAddress(accounts[0]);
            if (CONTRACT_CONFIG.address !== '0x...') {
              await initContract(provider);
            }
          }
        } catch (error) {
          console.log('No previous connection found:', error);
        }
      }
    };

    // Загружаем ethers.js
    loadEthers();

    // Проверяем подключение после загрузки
    const checkTimer = setInterval(() => {
      if (window.ethers) {
        checkConnection();
        clearInterval(checkTimer);
      }
    }, 100);

    return () => clearInterval(checkTimer);
  }, []);

  const WalletInstallGuide = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">👛</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Install a Web3 Wallet</h3>
          <p className="text-gray-600">
            To use Sendly, you need a Web3 wallet to interact with the blockchain
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <a 
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                🦊
              </div>
              <div>
                <h4 className="font-semibold">MetaMask</h4>
                <p className="text-sm text-gray-600">Most popular wallet</p>
              </div>
            </div>
          </a>
          
          <a 
            href="https://www.coinbase.com/wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                CB
              </div>
              <div>
                <h4 className="font-semibold">Coinbase Wallet</h4>
                <p className="text-sm text-gray-600">User-friendly option</p>
              </div>
            </div>
          </a>
          
          <a 
            href="https://trustwallet.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                TW
              </div>
              <div>
                <h4 className="font-semibold">Trust Wallet</h4>
                <p className="text-sm text-gray-600">Mobile & desktop</p>
              </div>
            </div>
          </a>
          
          <a 
            href="https://brave.com/wallet/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold">
                B
              </div>
              <div>
                <h4 className="font-semibold">Brave Wallet</h4>
                <p className="text-sm text-gray-600">Built into Brave browser</p>
              </div>
            </div>
          </a>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h5 className="font-semibold text-blue-900 mb-2">After Installation:</h5>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Install your chosen wallet extension</li>
            <li>2. Create a new wallet or import existing one</li>
            <li>3. Refresh this page</li>
            <li>4. Click "Connect Wallet" again</li>
          </ol>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setShowWalletInstall(false);
              setError('');
              // Проверяем снова после небольшой задержки
              setTimeout(() => {
                if (checkWeb3()) {
                  setError('');
                  console.log('Wallet detected after install!');
                } else {
                  setError('Wallet still not detected. Please refresh the page after installation.');
                }
              }, 1000);
            }}
            className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            I've Installed a Wallet
          </button>
          <button
            onClick={() => {
              setShowWalletInstall(false);
              setError('');
            }}
            className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const Navigation = () => (
    <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Sendly
              </div>
            </div>
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              <button
                onClick={() => setActiveSection('home')}
                className={`${activeSection === 'home' ? 'text-purple-600 border-purple-600' : 'text-gray-500 hover:text-gray-700'} border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors`}
              >
                Home
              </button>
              <button
                onClick={() => setActiveSection('create-card')}
                className={`${activeSection === 'create-card' ? 'text-purple-600 border-purple-600' : 'text-gray-500 hover:text-gray-700'} border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors`}
              >
                Create Card
              </button>
              <button
                onClick={() => setActiveSection('redeem-card')}
                className={`${activeSection === 'redeem-card' ? 'text-purple-600 border-purple-600' : 'text-gray-500 hover:text-gray-700'} border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors`}
              >
                Redeem Card
              </button>
              <button
                onClick={() => setActiveSection('how-it-works')}
                className={`${activeSection === 'how-it-works' ? 'text-purple-600 border-purple-600' : 'text-gray-500 hover:text-gray-700'} border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors`}
              >
                How It Works
              </button>
              <button
                onClick={() => setActiveSection('features')}
                className={`${activeSection === 'features' ? 'text-purple-600 border-purple-600' : 'text-gray-500 hover:text-gray-700'} border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors`}
              >
                Features
              </button>
              <button
                onClick={() => setActiveSection('merchants')}
                className={`${activeSection === 'merchants' ? 'text-purple-600 border-purple-600' : 'text-gray-500 hover:text-gray-700'} border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors`}
              >
                For Merchants
              </button>
              <button
                onClick={() => setActiveSection('faq')}
                className={`${activeSection === 'faq' ? 'text-purple-600 border-purple-600' : 'text-gray-500 hover:text-gray-700'} border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors`}
              >
                FAQ
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {walletConnected ? (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                  Soneium
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={connectWallet}
                  disabled={isLoading || !ethersLoaded}
                  className={`${isLoading || !ethersLoaded ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium`}
                >
                  {!ethersLoaded ? 'Loading...' : isLoading ? 'Connecting...' : 'Connect Wallet'}
                </button>
                <button
                  onClick={() => setShowWalletInstall(true)}
                  className="bg-blue-500 text-white px-2 py-2 rounded text-xs hover:bg-blue-600 transition-colors"
                >
                  Install Wallet
                </button>
                <button
                  onClick={() => {
                    console.log('=== WALLET DEBUG INFO ===');
                    console.log('window.ethereum:', !!window.ethereum);
                    console.log('window.ethers:', !!window.ethers);
                    console.log('ethersLoaded:', ethersLoaded);
                    if (window.ethereum) {
                      console.log('MetaMask detected:', window.ethereum.isMetaMask);
                      console.log('Selected address:', window.ethereum.selectedAddress);
                    }
                    alert('Check console for debug info');
                  }}
                  className="bg-gray-500 text-white px-2 py-2 rounded text-xs"
                >
                  Debug
                </button>
                {error && (
                  <div className="text-xs text-red-600 max-w-xs">
                    {error}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {['home', 'create-card', 'redeem-card', 'how-it-works', 'features', 'merchants', 'faq'].map((section) => (
              <button
                key={section}
                onClick={() => {
                  setActiveSection(section);
                  setMobileMenuOpen(false);
                }}
                className={`${activeSection === section ? 'text-purple-600 bg-purple-50' : 'text-gray-500'} block px-3 py-2 rounded-md text-base font-medium w-full text-left hover:text-purple-600 hover:bg-purple-50 transition-colors`}
              >
                {section.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );

  const Hero = () => (
    <section className="pt-20 bg-gradient-to-br from-purple-50 to-blue-50 min-h-screen flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
            Send Personalized{' '}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              NFT Gift Cards
            </span>
            <br />
            Anywhere, Anytime
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Bridge Web2 and Web3 with customizable digital gift cards powered by USDC/USDT on the Soneium network. 
            Built on Sony's innovative blockchain for seamless entertainment and gaming experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setActiveSection('create-card')}
              className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg"
            >
              Get Started
            </button>
            <button 
              onClick={() => setActiveSection('how-it-works')}
              className="border-2 border-purple-600 text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-600 hover:text-white transition-all duration-300"
            >
              Learn More
            </button>
          </div>
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-3xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold mb-2">Fully Customizable</h3>
              <p className="text-gray-600">Add personal messages and choose any USDC/USDT amount</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-3xl mb-4">🌍</div>
              <h3 className="text-xl font-semibold mb-2">Global Access</h3>
              <p className="text-gray-600">Send to anyone, anywhere in the world instantly</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold mb-2">No KYC Required</h3>
              <p className="text-gray-600">Easy redemption through smart wallets</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const HowItWorks = () => (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">How Sendly Works</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Four simple steps to create and send personalized NFT gift cards
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            {
              step: "1",
              title: "Create Your Card",
              description: "Design a personalized NFT gift card with custom messages and artwork",
              icon: "✨"
            },
            {
              step: "2",
              title: "Add Value",
              description: "Load your card with USDC or USDT - any amount you choose",
              icon: "💰"
            },
            {
              step: "3",
              title: "Send Instantly",
              description: "Send via wallet address, email, or shareable link anywhere in the world",
              icon: "🚀"
            },
            {
              step: "4",
              title: "Easy Redemption",
              description: "Recipients redeem to their smart wallet or spend on integrated platforms",
              icon: "🎁"
            }
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                {item.step}
              </div>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-semibold mb-4">{item.title}</h3>
              <p className="text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const Features = () => (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-purple-50">
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
              {
                title: "Web2-Web3 Bridge",
                description: "Seamlessly redeemable on traditional platforms like Amazon and Apple (coming soon) as well as decentralized ecosystems",
                icon: "🌉"
              },
              {
                title: "Soneium Network Powered",
                description: "Built on Sony's Soneium for ultra-fast, secure transactions with entertainment-grade infrastructure and gaming integrations",
                icon: "⚡"
              },
              {
                title: "Smart Wallet Integration",
                description: "No complex wallet setups - recipients can easily redeem through user-friendly smart wallets",
                icon: "🧠"
              }
            ].map((feature, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="text-3xl">{feature.icon}</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-xl">
            <h3 className="text-2xl font-bold mb-6">Coming Soon: Platform Integrations</h3>
            <div className="space-y-4">
              {[
                { name: "PlayStation Store", status: "In Development", color: "bg-blue-100 text-blue-800" },
                { name: "Sony Music", status: "Planned", color: "bg-purple-100 text-purple-800" },
                { name: "Sony Pictures", status: "Planned", color: "bg-red-100 text-red-800" },
                { name: "Amazon", status: "Planned", color: "bg-orange-100 text-orange-800" },
                { name: "Steam", status: "Exploring", color: "bg-gray-100 text-gray-800" }
              ].map((platform, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{platform.name}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${platform.color}`}>
                    {platform.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const Merchants = () => (
    <section className="py-20 bg-white">
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
                "Future-proof payment infrastructure",
                "Access to Sony's entertainment ecosystem",
                "Gaming and media integration opportunities"
              ].map((benefit, index) => (
                <li key={index} className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
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
                { step: 1, title: "API Integration", description: "Simple REST API for gift card redemption" },
                { step: 2, title: "Testing Phase", description: "Sandbox environment for thorough testing" },
                { step: 3, title: "Go Live", description: "Launch with full marketing support" }
              ].map((item, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <div>
                    <h5 className="font-semibold">{item.title}</h5>
                    <p className="text-gray-600 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const FAQ = () => {
    const [openIndex, setOpenIndex] = useState(0);
    
    const faqs = [
      {
        question: "What is an NFT gift card?",
        answer: "An NFT gift card is a unique digital token that represents a gift card loaded with USDC or USDT. It can be customized with personal messages and artwork, making it both valuable and meaningful."
      },
      {
        question: "How do I redeem a Sendly gift card?",
        answer: "Simply connect your Web3 wallet, enter the gift card details, and the funds will be transferred to your wallet. No KYC required - just a simple, secure transaction on the Soneium network."
      },
      {
        question: "Is Sendly secure?",
        answer: "Yes! Sendly is built on the Soneium network by Sony, providing entertainment-grade security and reliability. All transactions are cryptographically secured and immutable on the blockchain."
      },
      {
        question: "What wallets are supported?",
        answer: "Sendly supports all major Web3 wallets including MetaMask, Coinbase Wallet, WalletConnect, and smart wallets. We're constantly adding support for new wallets."
      },
      {
        question: "Can I use traditional platforms to spend my gift card?",
        answer: "Yes! We're building integrations with Sony's ecosystem including PlayStation Store, Sony Music, and Sony Pictures, as well as other major platforms. Recipients will be able to spend their gift cards across entertainment, gaming, and commerce platforms."
      },
      {
        question: "Are there any fees?",
        answer: "Sendly charges a small service fee for creating and sending gift cards. Recipients pay only the standard Soneium network gas fees for redemption, which are extremely low thanks to Sony's optimized infrastructure."
      }
    ];

    return (
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about Sendly
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                  className="w-full text-left p-6 focus:outline-none"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">{faq.question}</h3>
                    <svg
                      className={`w-6 h-6 text-gray-500 transform transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const RedeemCard = () => {
    const [tokenId, setTokenId] = useState('');
    const [giftCardInfo, setGiftCardInfo] = useState(null);
    const [redeemResult, setRedeemResult] = useState(null);

    const handleGetInfo = async () => {
      if (!tokenId) return;
      const info = await getGiftCardInfo(tokenId);
      setGiftCardInfo(info);
    };

    const handleRedeem = async () => {
      if (!tokenId) return;
      const result = await redeemGiftCard(tokenId);
      setRedeemResult(result);
      if (result.success) {
        // Обновляем информацию после погашения
        setTimeout(() => handleGetInfo(), 2000);
      }
    };

    return (
      <section className="pt-20 min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Redeem Your NFT Gift Card</h2>
            <p className="text-xl text-gray-600">
              Enter your gift card Token ID to claim your funds
            </p>
          </div>
          
          {!walletConnected ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="text-6xl mb-6">🔒</div>
              <h3 className="text-2xl font-bold mb-4">Connect Your Wallet</h3>
              <p className="text-gray-600 mb-8">
                To redeem NFT gift cards, please connect your Web3 wallet first.
              </p>
              <button
                onClick={connectWallet}
                disabled={isLoading}
                className={`${isLoading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'} text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors`}
              >
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gift Card Token ID
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={tokenId}
                      onChange={(e) => setTokenId(e.target.value)}
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter Token ID (e.g., 123)"
                    />
                    <button
                      onClick={handleGetInfo}
                      disabled={!tokenId || isLoading}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    >
                      Check
                    </button>
                  </div>
                </div>

                {giftCardInfo && (
                  <div className="bg-gradient-to-br from-green-400 to-blue-500 rounded-xl p-6 text-white">
                    <div className="text-center mb-4">
                      <div className="text-3xl mb-2">🎁</div>
                      <h4 className="text-xl font-bold">Sendly Gift Card #{tokenId}</h4>
                    </div>
                    <div className="bg-white/20 rounded-lg p-4 mb-4">
                      <p className="text-sm opacity-90">Message:</p>
                      <p className="font-medium">{giftCardInfo.message}</p>
                    </div>
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold">
                        ${giftCardInfo.amount} USDC
                      </div>
                      <p className="text-sm opacity-90">
                        Status: {giftCardInfo.redeemed ? 'Already Redeemed' : 'Available'}
                      </p>
                    </div>
                    
                    {!giftCardInfo.redeemed && (
                      <button
                        onClick={handleRedeem}
                        disabled={isLoading}
                        className="w-full bg-white text-purple-600 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors disabled:bg-gray-300"
                      >
                        {isLoading ? 'Redeeming...' : 'Redeem Gift Card'}
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {redeemResult && redeemResult.success && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-600 text-sm font-semibold">Gift Card Redeemed Successfully!</p>
                    <p className="text-green-600 text-xs mt-1">Transaction: {redeemResult.txHash}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const CreateCard = () => {
    const [cardData, setCardData] = useState({
      message: '',
      amount: '',
      recipientAddress: ''
    });
    const [createResult, setCreateResult] = useState(null);

    const handleCreateCard = async () => {
      if (!cardData.amount || parseFloat(cardData.amount) <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const result = await createGiftCard(
        cardData.recipientAddress,
        cardData.amount,
        cardData.message || 'Happy gifting!'
      );

      setCreateResult(result);
      
      if (result.success) {
        // Очищаем форму после успешного создания
        setCardData({ message: '', amount: '', recipientAddress: '' });
      }
    };

    return (
      <section className="pt-20 min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Create Your NFT Gift Card</h2>
            <p className="text-xl text-gray-600">
              Design a personalized gift card and send it instantly
            </p>
          </div>
          
          {!walletConnected ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="text-6xl mb-6">🔒</div>
              <h3 className="text-2xl font-bold mb-4">Connect Your Wallet</h3>
              <p className="text-gray-600 mb-8">
                To create and send NFT gift cards, please connect your Web3 wallet first.
              </p>
              <button
                onClick={connectWallet}
                className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold mb-6">Card Details</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Personal Message
                    </label>
                    <textarea
                      value={cardData.message}
                      onChange={(e) => setCardData({...cardData, message: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows="4"
                      placeholder="Happy Birthday! Hope you enjoy this gift..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (USDC)
                    </label>
                    <input
                      type="number"
                      value={cardData.amount}
                      onChange={(e) => setCardData({...cardData, amount: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipient Wallet Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={cardData.recipientAddress}
                      onChange={(e) => setCardData({...cardData, recipientAddress: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0x... or leave blank to generate shareable link"
                    />
                  </div>
                  <button 
                    onClick={handleCreateCard}
                    disabled={isLoading || !cardData.amount}
                    className={`w-full py-4 rounded-lg text-lg font-semibold transition-colors ${
                      isLoading || !cardData.amount
                        ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {isLoading ? 'Creating...' : 'Create Gift Card (0.01 ETH + Gas)'}
                  </button>
                  
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}
                  
                  {createResult && createResult.success && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-600 text-sm font-semibold">Gift Card Created Successfully!</p>
                      <p className="text-green-600 text-xs mt-1">Token ID: {createResult.tokenId}</p>
                      <p className="text-green-600 text-xs">Transaction: {createResult.txHash}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold mb-6">Preview</h3>
                <div className="bg-gradient-to-br from-purple-400 to-blue-500 rounded-xl p-6 text-white">
                  <div className="text-center mb-4">
                    <div className="text-3xl mb-2">🎁</div>
                    <h4 className="text-xl font-bold">Sendly Gift Card</h4>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4 mb-4">
                    <p className="text-sm opacity-90">Personal Message:</p>
                    <p className="font-medium">
                      {cardData.message || "Your personalized message will appear here..."}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      ${cardData.amount || "0"} USDC
                    </div>
                    <p className="text-sm opacity-90">Redeemable on Soneium Network</p>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold mb-2">What happens next?</h5>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Your gift card NFT will be minted on Soneium</li>
                    <li>• Recipient gets a secure redemption link</li>
                    <li>• Funds can be claimed to any Web3 wallet</li>
                    <li>• Future: Spend directly on Sony and partner platforms</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const Footer = () => (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Sendly
              </div>
            </div>
            <p className="text-gray-400 mb-4">
              The future of digital gifting, bridging Web2 and Web3 with personalized NFT gift cards powered by Sony's Soneium network.
            </p>
            <div className="flex space-x-4">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors cursor-pointer">
                <span className="text-sm">𝕏</span>
              </div>
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors cursor-pointer">
                <span className="text-sm">D</span>
              </div>
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors cursor-pointer">
                <span className="text-sm">M</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-gray-400">
              <li><button onClick={() => setActiveSection('how-it-works')} className="hover:text-white transition-colors">How It Works</button></li>
              <li><button onClick={() => setActiveSection('features')} className="hover:text-white transition-colors">Features</button></li>
              <li><button onClick={() => setActiveSection('create-card')} className="hover:text-white transition-colors">Create Card</button></li>
              <li><button onClick={() => setActiveSection('redeem-card')} className="hover:text-white transition-colors">Redeem Card</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-gray-400">
              <li><button className="hover:text-white transition-colors">About</button></li>
              <li><button className="hover:text-white transition-colors">Blog</button></li>
              <li><button onClick={() => setActiveSection('merchants')} className="hover:text-white transition-colors">Partners</button></li>
              <li><button className="hover:text-white transition-colors">Careers</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400">
              <li><button onClick={() => setActiveSection('faq')} className="hover:text-white transition-colors">FAQ</button></li>
              <li><button className="hover:text-white transition-colors">Help Center</button></li>
              <li><button className="hover:text-white transition-colors">Contact</button></li>
              <li><button className="hover:text-white transition-colors">Status</button></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © 2025 Sendly. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <button className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</button>
            <button className="text-gray-400 hover:text-white text-sm transition-colors">Terms of Service</button>
            <button className="text-gray-400 hover:text-white text-sm transition-colors">Cookie Policy</button>
          </div>
        </div>
      </div>
    </footer>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return (
          <>
            <Hero />
            <HowItWorks />
            <Features />
          </>
        );
      case 'how-it-works':
        return <HowItWorks />;
      case 'features':
        return <Features />;
      case 'merchants':
        return <Merchants />;
      case 'faq':
        return <FAQ />;
      case 'create-card':
        return <CreateCard />;
      case 'redeem-card':
        return <RedeemCard />;
      default:
        return (
          <>
            <Hero />
            <HowItWorks />
            <Features />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      {renderSection()}
      <Footer />
      {showWalletInstall && <WalletInstallGuide />}
    </div>
  );
};

export default SendlyWebsite;