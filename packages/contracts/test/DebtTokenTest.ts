import { ethers } from 'hardhat';
import { MockDebtToken, MockBorrowerOperations, MockTroveManager } from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { assertRevert, deployTesting } from '../utils/testHelper';
import { assert, expect } from 'chai';
import { AbiCoder, Signature, keccak256, toUtf8Bytes } from 'ethers';

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

describe('DebtToken', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;

  let troveManager: MockTroveManager;
  let borrowerOperations: MockBorrowerOperations;

  before(async () => {
    signers = await ethers.getSigners();
    [owner, , , , , alice, bob] = signers;
  });

  beforeEach(async () => {
    // @ts-ignore
    const contracts = await deployTesting();
    troveManager = contracts.troveManager;
    borrowerOperations = contracts.borrowerOperations;
    STABLE = contracts.STABLE;
    STOCK = contracts.STOCK;
  });

  const getDomainSeparator = (name: string, contractAddress: string, chainId: bigint, version: string) => {
    const abiCoder = AbiCoder.defaultAbiCoder();
    return keccak256(
      abiCoder.encode(
        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
        [
          keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
          keccak256(toUtf8Bytes(name)),
          keccak256(toUtf8Bytes(version)),
          parseInt(chainId.toString()),
          contractAddress.toLowerCase(),
        ]
      )
    );
  };

  const signPermit = async (
    signer: SignerWithAddress,
    name: string,
    contractAddress: string,
    chainId: bigint,
    version: string,
    owner: string,
    spender: string,
    value: bigint,
    nonce: bigint,
    deadline: bigint | number
  ) => {
    return await signer.signTypedData(
      {
        name: name,
        version: version,
        chainId: chainId,
        verifyingContract: contractAddress,
      },
      {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      {
        owner,
        spender,
        value,
        nonce,
        deadline,
      }
    );
  };

  it('balanceOf(): gets the balance of the account', async () => {
    // mint some debt tokens for alice
    await borrowerOperations.testDebtToken_mint(alice, 1, STABLE);

    const aliceBalance = await STABLE.balanceOf(alice);
    assert.equal(aliceBalance, 1n);

    const bobBalance = await STABLE.balanceOf(bob);
    assert.equal(bobBalance, 0n);
  });

  it('totalSupply(): gets the total supply', async () => {
    const totalSupplyBefore = await STABLE.totalSupply();

    // mint some debt tokens to increase total supply
    await borrowerOperations.testDebtToken_mint(alice, 1, STABLE);
    await borrowerOperations.testDebtToken_mint(bob, 2, STABLE);

    const totalSupply = await STABLE.totalSupply();
    assert.equal(totalSupply - totalSupplyBefore, 3n);
  });

  it("name(): returns the token's name", async () => {
    const name = await STABLE.name();
    assert.equal(name, 'jUSD');
  });

  it("symbol(): returns the token's symbol", async () => {
    const symbol = await STABLE.symbol();
    assert.equal(symbol, 'jUSD');
  });

  it('decimal(): returns the number of decimal digits used', async () => {
    const decimals = await STABLE.decimals();
    assert.equal(decimals, 18n);
  });

  it("version(): returns the token contract's version", async () => {
    const version = await STABLE.version();
    assert.equal(version, '1');
  });

  it('isStableCoin(): returns true if token is initialized as stable or false if not', async () => {
    const isStableCointStable = await STABLE.isStableCoin();
    assert.isTrue(isStableCointStable);

    const isStockTokenStable = await STOCK.isStableCoin();
    assert.isFalse(isStockTokenStable);
  });

  it('Initializes PERMIT_TYPEHASH correctly', async () => {
    const hash = await STABLE.permitTypeHash();
    assert.equal(hash, '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9');
  });

  it("increaseAllowance(): increases an account's allowance by the correct amount", async () => {
    const allowance_A_Before = await STABLE.allowance(owner, alice);
    assert.equal(allowance_A_Before, 0n);

    await STABLE.increaseAllowance(alice, 100);

    const allowance_A_After = await STABLE.allowance(owner, alice);
    assert.equal(allowance_A_After, 100n);
  });

  it('decreaseAllowance(): decreases allowance by the expected amount', async () => {
    await STABLE.approve(alice, 100);

    await STABLE.decreaseAllowance(alice, 25);

    const alice_allowanceAfter = await STABLE.allowance(owner, alice);
    assert.equal(alice_allowanceAfter, 75n);
  });

  it('decreaseAllowance(): fails trying to decrease more than previously allowed', async () => {
    await STABLE.approve(alice, 100);

    const tx = STABLE.decreaseAllowance(alice, 101);

    await assertRevert(tx);
  });

  it('DOMAIN_SEPARATOR remains unchanged', async () => {
    const domainSeparator = await STABLE.domainSeparator();

    const tokenName = await STABLE.name();
    const version = await STABLE.version();
    const chainId = await STABLE.getChainId();
    const generatedDomain = getDomainSeparator(tokenName, STABLE.target.toString(), chainId, version);

    assert.equal(domainSeparator, generatedDomain);
  });

  it('Initial nonce for a given address is 0', async () => {
    const alicesNonde = await STABLE.nonces(alice);

    assert.equal(alicesNonde, 0n);
  });

  describe('approve()', () => {
    it('approve(): reverts when owner param is address(0)', async () => {
      const txPromise = STABLE.approve(ethers.ZeroAddress, 100);
      await assertRevert(txPromise);
    });

    it('approve(): emits "Approval" event with expected arguments', async () => {
      const tx = STABLE.approve(alice, 100);

      await expect(tx).to.emit(STABLE, 'Approval').withArgs(owner.address, alice.address, 100);
    });

    it("allowance(): returns an account's spending allowance for another account's balance", async () => {
      const allowance_before = await STABLE.allowance(owner, alice);
      assert.equal(allowance_before, 0n);

      await STABLE.approve(alice, 100);

      const allowance_after = await STABLE.allowance(owner, alice);
      assert.equal(allowance_after, 100n);
    });
  });

  describe('transferFrom()', () => {
    it('transferFrom(): reverts if recipient is ZeroAddress', async () => {
      const tx = STABLE.transferFrom(alice, ethers.ZeroAddress, 40);

      await assertRevert(tx, 'ZeroAddress');
    });

    it('transferFrom(): reverts if recipient is self', async () => {
      const tx = STABLE.transferFrom(alice, STABLE, 40);

      await assertRevert(tx, 'ZeroAddress');
    });

    it('transferFrom(): reverts if recipient is troveManagerAddress, borrowerOperationsAddress', async () => {
      const txTM = STABLE.transferFrom(alice, troveManager, 40);
      await assertRevert(txTM, 'NotAllowedDirectTransfer');

      const txBO = STABLE.transferFrom(alice, borrowerOperations, 40);
      await assertRevert(txBO, 'NotAllowedDirectTransfer');
    });

    it('transferFrom(): reverts if more is transfered than allowed', async () => {
      await borrowerOperations.testDebtToken_mint(owner, 100, STABLE);
      await STABLE.approve(alice, 40);

      const tx = STABLE.connect(alice).transferFrom(owner, bob, 41);

      await assertRevert(tx);
    });

    it('transferFrom(): successfully transfers from an account which is it approved to transfer from', async () => {
      const myBalanceBefore = await STABLE.balanceOf(owner);

      await borrowerOperations.testDebtToken_mint(owner, 100, STABLE);
      await STABLE.approve(alice, 100);

      const bobBalance_before = await STABLE.balanceOf(bob);
      assert.equal(bobBalance_before, 0n);

      await STABLE.connect(alice).transferFrom(owner, bob, 90);

      const bobBalance_after = await STABLE.balanceOf(bob);
      assert.equal(bobBalance_after, 90n);

      const myBalance = await STABLE.balanceOf(owner);
      assert.equal(myBalance - myBalanceBefore, 10n);
    });
  });

  describe('transfer()', () => {
    it('transfer(): reverts if recipient is ZeroAddress', async () => {
      const tx = STABLE.transfer(ethers.ZeroAddress, 40);

      await assertRevert(tx, 'ZeroAddress');
    });

    it('transfer(): reverts if recipient is self', async () => {
      const tx = STABLE.transfer(STABLE, 40);

      await assertRevert(tx, 'ZeroAddress');
    });

    it('transfer(): reverts if recipient is troveManagerAddress, borrowerOperationsAddress', async () => {
      const txTM = STABLE.transfer(troveManager, 40);
      await assertRevert(txTM, 'NotAllowedDirectTransfer');

      const txBO = STABLE.transfer(borrowerOperations, 40);
      await assertRevert(txBO, 'NotAllowedDirectTransfer');
    });

    it("transfer(): reverts if amount exceeds sender's balance", async () => {
      const balance = await STABLE.balanceOf(owner);
      const txPromise = STABLE.transfer(alice, balance + 1n);

      await assertRevert(txPromise, 'InsufficientBalance');
    });

    it("transfer(): increases the recipient's balance by the correct amount", async () => {
      await borrowerOperations.testDebtToken_mint(owner, 100, STABLE);

      const aliceBalance_before = await STABLE.balanceOf(alice);
      await STABLE.transfer(alice, 40);

      const aliceBalance_after = await STABLE.balanceOf(alice);
      assert.equal(aliceBalance_after, 40n + aliceBalance_before);

      const myBalance = await STABLE.balanceOf(owner);
      assert.equal(myBalance, 60n);
    });

    it('transfer(): emits "Transfer" event with expected arguments', async () => {
      await borrowerOperations.testDebtToken_mint(owner, 40, STABLE);

      const tx = STABLE.transfer(alice, 40);

      await expect(tx).to.emit(STABLE, 'Transfer').withArgs(owner.address, alice.address, 40);
    });
  });

  describe('mint()', () => {
    it('mint(): issues correct amount of tokens to the given address', async () => {
      const alice_balanceBefore = await STABLE.balanceOf(alice);
      assert.equal(alice_balanceBefore, 0n);

      await borrowerOperations.testDebtToken_mint(alice, 100, STABLE);

      const alice_balanceAfter = await STABLE.balanceOf(alice);
      assert.equal(alice_balanceAfter, 100n);
    });

    it('mint(): increases totalAmount incrementally', async () => {
      const totalSupply_before = await STABLE.totalSupply();

      await borrowerOperations.testDebtToken_mint(alice, 100, STABLE);
      await borrowerOperations.testDebtToken_mint(bob, 50, STABLE);

      const totalSupply_after = await STABLE.totalSupply();
      assert.equal(totalSupply_after, 150n + totalSupply_before);
    });

    it('mint(): reverts if not borrowerOperations', async () => {
      const tx = STABLE.mint(alice, 100);

      await assertRevert(tx, 'NotFromBorrowerOps');
    });

    it('mint(): reverts if account is ZeroAddress', async () => {
      const tx = borrowerOperations.testDebtToken_mint(ethers.ZeroAddress, 100, STABLE);

      await assertRevert(tx);
    });

    it('mint(): emits "Transfer" event with expected arguments', async () => {
      const tx = borrowerOperations.testDebtToken_mint(alice, 100, STABLE);

      await expect(tx).to.emit(STABLE, 'Transfer').withArgs(ethers.ZeroAddress, alice.address, 100);
    });
  });

  describe('burn()', () => {
    it('burn(): burns correct amount of tokens from the given address', async () => {
      await borrowerOperations.testDebtToken_mint(alice, 100, STABLE);
      await borrowerOperations.testDebtToken_burn(alice, 70, STABLE);

      const alice_BalanceAfter = await STABLE.balanceOf(alice);
      assert.equal(alice_BalanceAfter, 30n);
    });

    it('burn(): reverts if not borrowerOperations or troveManager', async () => {
      const tx = STABLE.burn(alice, 100);
      await assertRevert(tx, 'NotFromBOorTroveMorSP');
    });

    it('burn(): reverts if account is ZeroAddress', async () => {
      const tx = STABLE.burn(ethers.ZeroAddress, 100);
      await assertRevert(tx);
    });

    it('burn(): reduces totalAmount incrementally', async () => {
      const totalSupply_before_before = await STABLE.totalSupply();

      await borrowerOperations.testDebtToken_mint(alice, 100, STABLE);
      await borrowerOperations.testDebtToken_mint(bob, 50, STABLE);

      const totalSupply_before = await STABLE.totalSupply();
      assert.equal(totalSupply_before, 150n + totalSupply_before_before);

      await borrowerOperations.testDebtToken_burn(alice, 50, STABLE);
      await borrowerOperations.testDebtToken_burn(bob, 25, STABLE);

      const totalSupply_after = await STABLE.totalSupply();
      assert.equal(totalSupply_after, 75n + totalSupply_before_before);
    });

    it('burn(): emits "Transfer" event with expected arguments', async () => {
      await borrowerOperations.testDebtToken_mint(alice, 100, STABLE);
      const tx = borrowerOperations.testDebtToken_burn(alice, 100, STABLE);

      await expect(tx).to.emit(STABLE, 'Transfer').withArgs(alice.address, ethers.ZeroAddress, 100);
    });
  });

  describe('permit()', () => {
    it('permit(): approval of owner from a third party', async () => {
      const tokenName = await STABLE.name();
      const version = await STABLE.version();
      const chainId = await STABLE.getChainId();
      const nonce = await STABLE.nonces(alice);
      const deadline = 100000000000000;
      const value = 1n;

      const signature = await signPermit(
        alice,
        tokenName,
        STABLE.target.toString(),
        chainId,
        version,
        alice.address,
        bob.address,
        value,
        nonce,
        deadline
      );
      const { v, r, s } = Signature.from(signature);

      await STABLE.connect(alice).permit(alice, bob, value, deadline, v, r, s);

      const allowance = await STABLE.allowance(alice, bob);
      assert.equal(allowance, value);
    });

    it('permit() send approval event when successfull', async () => {
      const tokenName = await STABLE.name();
      const version = await STABLE.version();
      const chainId = await STABLE.getChainId();
      const nonce = await STABLE.nonces(alice);
      const deadline = 100000000000000;
      const value = 1n;

      const signature = await signPermit(
        alice,
        tokenName,
        STABLE.target.toString(),
        chainId,
        version,
        alice.address,
        bob.address,
        value,
        nonce,
        deadline
      );
      const { v, r, s } = Signature.from(signature);

      const tx = STABLE.permit(alice, bob, value, deadline, v, r, s);

      await expect(tx).to.emit(STABLE, 'Approval').withArgs(alice.address, bob.address, value);
    });

    it('permit() fails if deadline has been overdue', async () => {
      const tokenName = await STABLE.name();
      const version = await STABLE.version();
      const chainId = await STABLE.getChainId();
      const nonce = await STABLE.nonces(alice);
      // Today as of writing this
      const deadline = 1698383579;
      const value = 1n;

      const signature = await signPermit(
        alice,
        tokenName,
        STABLE.target.toString(),
        chainId,
        version,
        alice.address,
        bob.address,
        value,
        nonce,
        deadline
      );
      const { v, r, s } = Signature.from(signature);

      const tx = STABLE.permit(alice, bob, value, deadline, v, r, s);

      await assertRevert(tx, 'ExpiredDeadline');
    });

    it('permit() fails if deadline has been overdue', async () => {
      const deadline = 100000000000000;
      const value = 1n;

      const tx = STABLE.permit(
        alice,
        bob,
        value,
        deadline,
        27,
        // valid but malformed signature
        '0xafea649b9689d61b6a59ebe3c72540f87832e02196315b9639ad05709e9f48bf',
        '0x33fd2733ec25c13406ac7258cb526f208f2698a0774b20c42a4088684a2074f8'
      );

      await assertRevert(tx, 'InvalidSignature');
    });
  });
});
