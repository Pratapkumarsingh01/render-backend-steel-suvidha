const { ObjectId } = require('mongodb');
const database = require('../services/database');


class QuoteController {
  /**
   * Create a new quote request.
   */
  async createQuote(req, res) {
    try {
      const {
        buyerId,
        buyerName,
        productName,
        requestedQuantity,
        items,
        buyerAddress,
        productId,
        sellerId,
        targetedPrice,
        deliveryDate,
        status,
        isBroadcast 
      } = req.body;

      if (!buyerId || !buyerName) {
        return res.status(400).json({ error: 'buyerId and buyerName are required' });
      }

      let finalItems = items || [
        {
          productId: productId,
          productName: productName,
          quantity: requestedQuantity
        }
      ];

      const quotesCollection = database.getQuotesCollection();
      const productsCollection = database.getProductsCollection();
      const usersCollection = database.getUsersCollection();

      const now = new Date();
      let matchedSellers = [];
      let broadcastStatus = null;

      if (sellerId === 'BROADCAST' || sellerId === 'MULTIPLE' || !sellerId || isBroadcast === true || isBroadcast === 'true') {
        let masterProductIds = [];
        
        for (const item of finalItems) {
          let masterProduct = null;
          if (item.productId) {
            try {
              masterProduct = await productsCollection.findOne({
                _id: new ObjectId(item.productId),
                isMaster: true
              });
            } catch (e) {
              masterProduct = await productsCollection.findOne({ name: item.productName, isMaster: true });
            }
          } else {
            masterProduct = await productsCollection.findOne({ name: item.productName, isMaster: true });
          }
          if (masterProduct) masterProductIds.push(masterProduct._id.toString());
        }

        if (masterProductIds.length > 0) {
          const sellerProducts = await productsCollection.find({
            masterProductId: { $in: masterProductIds },
            isMaster: false,
            status: 'Active'
          }).toArray();

          const uniqueSellerIds = [...new Set(sellerProducts.map(p => p.sellerId).filter(id => id))];

          for (const id of uniqueSellerIds) {
            try {
              const seller = await usersCollection.findOne({
                _id: new ObjectId(id),
                role: 'Seller'
              });
              if (seller) {
                matchedSellers.push({
                  sellerId: id,
                  sellerName: seller.name || 'Unknown Seller'
                });
              }
            } catch (err) {
              console.error(`Error fetching seller ${id}:`, err.message);
            }
          }
          broadcastStatus = matchedSellers.length > 0 ? 'BROADCASTED' : 'NO_SELLERS';
        } else {
          broadcastStatus = 'GENERAL_BROADCAST';
        }
      }

      const quoteData = {
        buyerId: buyerId,
        buyerName: buyerName,
        items: finalItems,
        productName: finalItems[0]?.productName || productName || 'Steel Items',
        requestedQuantity: finalItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0),
        buyerAddress: buyerAddress || null,
        sellerId: (sellerId === 'BROADCAST' || sellerId === 'MULTIPLE' || isBroadcast) ? null : sellerId,
        targetedPrice: targetedPrice || null,
        deliveryDate: deliveryDate || null,
        status: status || 'pending', 
        isBroadcast: isBroadcast === true || isBroadcast === 'true' || sellerId === 'BROADCAST' || !sellerId, 
        broadcastStatus: broadcastStatus,
        matchedSellersCount: matchedSellers.length,
        matchedSellers: matchedSellers,
        offers: [],
        transactions: [],
        createdAt: now,
        updatedAt: now
      };

      const result = await quotesCollection.insertOne(quoteData);
      quoteData._id = result.insertedId;

      res.status(201).json({
        success: true,
        message: 'Quote created successfully',
        quote: quoteData
      });
    } catch (error) {
      console.error('Create quote error:', error);
      res.status(500).json({ error: 'Failed to create quote' });
    }
  }

  async getQuoteById(req, res) {
    try {
      const { id } = req.params;
      const { sellerId, buyerId } = req.query; 
      const quotesCollection = database.getQuotesCollection();
      const quote = await quotesCollection.findOne({ _id: new ObjectId(id) });
      
      if (!quote) return res.status(404).json({ error: 'Quote not found' });
      
      const responseQuote = { ...quote };
      
      if (buyerId) {
        delete responseQuote.buyerDetails;
        delete responseQuote.buyerPhone;
        delete responseQuote.buyerEmail;
        delete responseQuote.buyerFullName;
      }
      else if (sellerId) {
        const s = quote.status.toLowerCase();
        if (s === 'pending' || s === 'quoted') {
          delete responseQuote.buyerDetails;
          delete responseQuote.buyerPhone;
          delete responseQuote.buyerEmail;
          delete responseQuote.buyerFullName;
        }
      }
      
      res.json(responseQuote);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch quote details' });
    }
  }

  async getAvailableQuotes(req, res) {
    try {
      const quotesCollection = database.getQuotesCollection();
      
      const quotes = await quotesCollection
        .find({
          $and: [
            {
              $or: [
                { isBroadcast: true },
                { isBroadcast: 'true' },
                { sellerId: null },
                { sellerId: "" },
                { broadcastStatus: 'BROADCASTED' },
                { broadcastStatus: 'GENERAL_BROADCAST' }
              ]
            },
            { 
              status: { $in: ['Pending', 'pending', 'Quoted', 'quoted'] } 
            }
          ]
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(quotes);
    } catch (error) {
      console.error('Get available quotes error:', error);
      res.status(500).json({ error: 'Failed to fetch available quotes' });
    }
  }

  async submitSellerOffer(req, res) {
    try {
      const { id } = req.params; 
      const { sellerId, sellerName, offeredPrice, itemBids, message, timestamp } = req.body;
      const quotesCollection = database.getQuotesCollection();

      // Automatically compute overall contract value accumulation if frontend sends an itemised list array
      let calculatedTotalPrice = parseFloat(offeredPrice || 0);
      if (itemBids && Array.isArray(itemBids)) {
        calculatedTotalPrice = itemBids.reduce((sum, bid) => sum + (parseFloat(bid.offeredPrice) || 0), 0);
      }

      const newOffer = {
        offerId: new ObjectId().toString(),
        sellerId: sellerId,
        sellerName: sellerName,
        offeredPrice: calculatedTotalPrice,
        itemBids: itemBids || [], // NEW: Injects itemized nested bids array object
        message: message || "", // This is the 'Note to Buyer'
        status: 'Pending',
        timestamp: timestamp ? new Date(timestamp) : new Date()
      };

      await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $pull: { offers: { sellerId: sellerId } }
        }
      );

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $push: { offers: newOffer },
          $set: { status: 'quoted', updatedAt: new Date() } 
        }
      );

      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });

      res.json({ success: true, offer: newOffer });
    } catch (error) {
      console.error('Submit seller offer error:', error);
      res.status(500).json({ error: 'Failed to submit offer' });
    }
  }

  async acceptSellerOffer(req, res) {
    try {
      const { id } = req.params;
      const { offerId, sellerId, sellerName, finalPrice } = req.body;
      const quotesCollection = database.getQuotesCollection();
      const usersCollection = database.getUsersCollection();

      const quote = await quotesCollection.findOne({ _id: new ObjectId(id) });
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      const buyer = await usersCollection.findOne(
        { _id: new ObjectId(quote.buyerId) },
        { projection: { password: 0 } }
      );

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status: 'accepted', 
            deliveryStatus: 'accepted', 
            sellerId: sellerId, 
            sellerName: sellerName,
            finalPrice: finalPrice, 
            acceptedOfferId: offerId,
            buyerDetails: {
              name: buyer?.name || quote.buyerName,
              phoneNumber: buyer?.phone || '',
              address: buyer?.address || quote.buyerAddress || '',
              email: buyer?.email || ''
            },
            buyerPhone: buyer?.phone || '',
            buyerEmail: buyer?.email || '',
            buyerFullName: buyer?.name || quote.buyerName,
            updatedAt: new Date() 
          } 
        }
      );

      res.json({ success: true, message: 'Offer accepted. Please proceed to payment.' });
    } catch (error) {
      console.error('Accept offer error:', error);
      res.status(500).json({ error: 'Failed to accept offer' });
    }
  }

  async submitPayment(req, res) {
    try {
      const { id } = req.params;
      const { transactionId, amount, note } = req.body;
      const quotesCollection = database.getQuotesCollection();

      const paymentEntry = {
        transactionId: transactionId,
        amount: parseFloat(amount),
        note: note || "",
        submittedAt: new Date()
      };

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $push: { transactions: paymentEntry }, // Push to array instead of overwriting
          $set: { 
            transactionId: transactionId, // Keep for backward compatibility
            paidAmount: parseFloat(amount),
            status: 'accepted', 
            paymentVerifyStatus: 'Pending',
            updatedAt: new Date()
          } 
        }
      );

      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });

      res.json({ success: true, message: 'Payment details submitted successfully.' });
    } catch (error) {
      console.error('Submit payment error:', error);
      res.status(500).json({ error: 'Failed to submit payment details' });
    }
  }

  async getQuotesByBuyer(req, res) {
    try {
      const { buyerId } = req.params;
      const quotesCollection = database.getQuotesCollection();
      
      const quotes = await quotesCollection
        .find({ buyerId: buyerId })
        .sort({ createdAt: -1 })
        .toArray();

      const formattedQuotes = quotes.map(q => ({
        ...q,
        id: q._id.toString(),
        offers: q.offers || []
      }));

      res.json(formattedQuotes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get quotes' });
    }
  }

  async getQuotesBySeller(req, res) {
    try {
      const { sellerId } = req.params;
      const quotesCollection = database.getQuotesCollection();
      
      const quotes = await quotesCollection
        .find({
          $or: [
            { sellerId: sellerId },
            {
              $and: [
                { $or: [{ sellerId: null }, { sellerId: "" }] },
                { $or: [{ isBroadcast: true }, { isBroadcast: 'true' }] },
                // Standardized statuses to prevent orders from vanishing
                { status: { $in: ['pending', 'Pending', 'quoted', 'Quoted', 'accepted', 'Accepted', 'processing', 'In Progress'] } }
              ]
            },
            { 'matchedSellers.sellerId': sellerId }
          ]
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(quotes);
    } catch (error) {
      console.error('Error in getQuotesBySeller:', error);
      res.status(500).json({ error: 'Failed to get quotes' });
    }
  }

  async markAsPaid(req, res) {
    try {
      const { id } = req.params;
      const quotesCollection = database.getQuotesCollection();
      
      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status: 'processing',
            deliveryStatus: 'in progress', 
            paidAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
      
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });
      res.json({ success: true, message: 'Payment confirmed. Order is now in Processing.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to confirm payment' });
    }
  }

  async updateDeliveryStatus(req, res) {
    try {
      const { id } = req.params;
      const { deliveryStatus, sellerId } = req.body;
      
      const validStatuses = ['In Progress', 'Dispatched', 'Out for Delivery', 'Delivered'];
      
      const quotesCollection = database.getQuotesCollection();
      const quote = await quotesCollection.findOne({ _id: new ObjectId(id) });
      
      if (!quote) return res.status(404).json({ error: 'Quote not found' });
      if (quote.sellerId !== sellerId) return res.status(403).json({ error: 'Unauthorized' });

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { deliveryStatus: deliveryStatus, updatedAt: new Date() } }
      );

      res.json({ success: true, message: `Status updated to ${deliveryStatus}` });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update delivery status' });
    }
  }

  async updateQuote(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const quotesCollection = database.getQuotesCollection();
      updateData.updatedAt = new Date();
      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });
      const updatedQuote = await quotesCollection.findOne({ _id: new ObjectId(id) });
      res.json({ success: true, quote: updatedQuote });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update quote' });
    }
  }
}

module.exports = new QuoteController();